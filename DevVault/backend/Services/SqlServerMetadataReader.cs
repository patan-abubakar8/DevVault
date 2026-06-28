using System;
using System.Collections.Generic;
using System.Data;
using Microsoft.Data.SqlClient;
using DBMigrator.Api.Models;

namespace DBMigrator.Api.Services
{
    public interface ISqlServerMetadataReader
    {
        bool TestConnection(string connectionString, out string error);
        SchemaAnalysisResult AnalyzeSchema(string connectionString);
    }

    public class SqlServerMetadataReader : ISqlServerMetadataReader
    {
        public bool TestConnection(string connectionString, out string error)
        {
            try
            {
                using var conn = new SqlConnection(connectionString);
                conn.Open();
                error = string.Empty;
                return true;
            }
            catch (Exception ex)
            {
                error = ex.Message;
                return false;
            }
        }

        public SchemaAnalysisResult AnalyzeSchema(string connectionString)
        {
            var result = new SchemaAnalysisResult();
            var tablesMap = new Dictionary<string, TableMetadata>();

            using (var conn = new SqlConnection(connectionString))
            {
                conn.Open();

                // 1. Get Tables and Row Counts
                string tablesQuery = @"
                    SELECT 
                        s.name AS SchemaName,
                        t.name AS TableName,
                        SUM(p.rows) AS [RowCount]
                    FROM 
                        sys.tables t
                    INNER JOIN 
                        sys.schemas s ON t.schema_id = s.schema_id
                    INNER JOIN 
                        sys.indexes i ON t.object_id = i.object_id AND i.type <= 1
                    INNER JOIN 
                        sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
                    WHERE 
                        t.is_ms_shipped = 0
                    GROUP BY 
                        s.name, t.name
                    ORDER BY 
                        s.name, t.name;";

                using (var cmd = new SqlCommand(tablesQuery, conn))
                using (var reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        var schema = reader.GetString(0);
                        var name = reader.GetString(1);
                        var rows = reader.GetInt64(2);

                        var tableMeta = new TableMetadata
                        {
                            SchemaName = schema,
                            TableName = name,
                            RowCount = rows
                        };

                        tablesMap[$"{schema}.{name}"] = tableMeta;
                        result.Tables.Add(tableMeta);
                    }
                }

                // 2. Get Columns and Details
                string columnsQuery = @"
                    SELECT 
                        s.name AS SchemaName,
                        t.name AS TableName,
                        c.name AS ColumnName,
                        tp.name AS DataType,
                        c.is_nullable AS IsNullable,
                        c.is_identity AS IsIdentity,
                        c.max_length AS MaxLength,
                        c.precision AS Precision,
                        c.scale AS Scale,
                        d.definition AS DefaultValue,
                        CASE WHEN pk.column_id IS NOT NULL THEN 1 ELSE 0 END AS IsPrimaryKey
                    FROM 
                        sys.columns c
                    INNER JOIN 
                        sys.tables t ON c.object_id = t.object_id
                    INNER JOIN 
                        sys.schemas s ON t.schema_id = s.schema_id
                    INNER JOIN 
                        sys.types tp ON c.user_type_id = tp.user_type_id
                    LEFT JOIN 
                        sys.default_constraints d ON c.default_object_id = d.object_id
                    LEFT JOIN (
                        SELECT 
                            ic.object_id,
                            ic.column_id
                        FROM 
                            sys.index_columns ic
                        INNER JOIN 
                            sys.indexes idx ON ic.object_id = idx.object_id AND ic.index_id = idx.index_id
                        WHERE 
                            idx.is_primary_key = 1
                    ) pk ON c.object_id = pk.object_id AND c.column_id = pk.column_id
                    WHERE 
                        t.is_ms_shipped = 0
                    ORDER BY 
                        s.name, t.name, c.column_id;";

                using (var cmd = new SqlCommand(columnsQuery, conn))
                using (var reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        var schema = reader.GetString(0);
                        var table = reader.GetString(1);
                        var key = $"{schema}.{table}";

                        if (tablesMap.TryGetValue(key, out var tableMeta))
                        {
                            var maxLen = reader.GetInt16(6);
                            var prec = reader.GetByte(7);
                            var scale = reader.GetByte(8);
                            string sourceDataType = reader.GetString(3);

                            var col = new ColumnMetadata
                            {
                                Name = reader.GetString(2),
                                SourceType = sourceDataType,
                                IsNullable = reader.GetBoolean(4),
                                IsIdentity = reader.GetBoolean(5),
                                MaxLength = maxLen == -1 ? -1 : maxLen,
                                Precision = prec,
                                Scale = scale,
                                DefaultValue = reader.IsDBNull(9) ? null : reader.GetString(9),
                                IsPrimaryKey = reader.GetInt32(10) == 1
                            };

                            // NVARCHAR/NCHAR length is halved in raw storage bytes (SQL Server store 2 bytes per char)
                            // but in terms of length definitions, if maxLen is odd/even we adjust
                            if ((sourceDataType.Equals("nvarchar", StringComparison.OrdinalIgnoreCase) || 
                                 sourceDataType.Equals("nchar", StringComparison.OrdinalIgnoreCase)) && col.MaxLength > 0)
                            {
                                col.MaxLength = col.MaxLength / 2;
                            }

                            col.TargetType = MapToPostgresType(col);
                            tableMeta.Columns.Add(col);
                        }
                    }
                }

                // 3. Get Foreign Keys
                string fkQuery = @"
                    SELECT 
                        fk.name AS ConstraintName,
                        s.name AS SchemaName,
                        t.name AS TableName,
                        col.name AS ColumnName,
                        ref_s.name AS ReferencedSchemaName,
                        ref_t.name AS ReferencedTableName,
                        ref_col.name AS ReferencedColumnName,
                        fk.delete_referential_action_desc AS OnDeleteAction,
                        fk.update_referential_action_desc AS OnUpdateAction
                    FROM 
                        sys.foreign_keys fk
                    INNER JOIN 
                        sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
                    INNER JOIN 
                        sys.tables t ON fk.parent_object_id = t.object_id
                    INNER JOIN 
                        sys.schemas s ON t.schema_id = s.schema_id
                    INNER JOIN 
                        sys.columns col ON fkc.parent_object_id = col.object_id AND fkc.parent_column_id = col.column_id
                    INNER JOIN 
                        sys.tables ref_t ON fk.referenced_object_id = ref_t.object_id
                    INNER JOIN 
                        sys.schemas ref_s ON ref_t.schema_id = ref_s.schema_id
                    INNER JOIN 
                        sys.columns ref_col ON fkc.referenced_object_id = ref_col.object_id AND fkc.referenced_column_id = ref_col.column_id
                    ORDER BY 
                        fk.name, fkc.constraint_column_id;";

                var fkDict = new Dictionary<string, ForeignKeyMetadata>();

                using (var cmd = new SqlCommand(fkQuery, conn))
                using (var reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        var constraintName = reader.GetString(0);
                        var schema = reader.GetString(1);
                        var table = reader.GetString(2);
                        var colName = reader.GetString(3);
                        var refSchema = reader.GetString(4);
                        var refTable = reader.GetString(5);
                        var refColName = reader.GetString(6);
                        var deleteAction = reader.GetString(7).Replace("_", " ");
                        var updateAction = reader.GetString(8).Replace("_", " ");

                        var dictKey = $"{schema}.{table}.{constraintName}";

                        if (!fkDict.TryGetValue(dictKey, out var fkMeta))
                        {
                            fkMeta = new ForeignKeyMetadata
                            {
                                ConstraintName = constraintName,
                                TableName = $"{schema}.{table}",
                                ReferencedTableName = $"{refSchema}.{refTable}",
                                OnDeleteAction = deleteAction,
                                OnUpdateAction = updateAction
                            };
                            fkDict[dictKey] = fkMeta;

                            var tableKey = $"{schema}.{table}";
                            if (tablesMap.TryGetValue(tableKey, out var parentTable))
                            {
                                parentTable.ForeignKeys.Add(fkMeta);
                            }
                        }

                        fkMeta.Columns.Add(colName);
                        fkMeta.ReferencedColumns.Add(refColName);
                    }
                }

                // 4. Get Indexes (excluding Primary Keys, which are handled separately)
                string indexesQuery = @"
                    SELECT 
                        idx.name AS IndexName,
                        s.name AS SchemaName,
                        t.name AS TableName,
                        col.name AS ColumnName,
                        idx.is_unique AS IsUnique,
                        idx.is_primary_key AS IsPrimaryKey
                    FROM 
                        sys.indexes idx
                    INNER JOIN 
                        sys.index_columns ic ON idx.object_id = ic.object_id AND idx.index_id = ic.index_id
                    INNER JOIN 
                        sys.tables t ON idx.object_id = t.object_id
                    INNER JOIN 
                        sys.schemas s ON t.schema_id = s.schema_id
                    INNER JOIN 
                        sys.columns col ON ic.object_id = col.object_id AND ic.column_id = col.column_id
                    WHERE 
                        t.is_ms_shipped = 0 
                        AND idx.name IS NOT NULL
                        AND idx.is_primary_key = 0
                    ORDER BY 
                        idx.name, ic.key_ordinal;";

                var idxDict = new Dictionary<string, IndexMetadata>();

                using (var cmd = new SqlCommand(indexesQuery, conn))
                using (var reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        var indexName = reader.GetString(0);
                        var schema = reader.GetString(1);
                        var table = reader.GetString(2);
                        var colName = reader.GetString(3);
                        var isUnique = reader.GetBoolean(4);
                        var isPk = reader.GetBoolean(5);

                        var dictKey = $"{schema}.{table}.{indexName}";

                        if (!idxDict.TryGetValue(dictKey, out var idxMeta))
                        {
                            idxMeta = new IndexMetadata
                            {
                                IndexName = indexName,
                                IsUnique = isUnique,
                                IsPrimaryKey = isPk
                            };
                            idxDict[dictKey] = idxMeta;

                            var tableKey = $"{schema}.{table}";
                            if (tablesMap.TryGetValue(tableKey, out var parentTable))
                            {
                                parentTable.Indexes.Add(idxMeta);
                            }
                        }

                        idxMeta.Columns.Add(colName);
                    }
                }
            }

            return result;
        }

        private string MapToPostgresType(ColumnMetadata col)
        {
            var type = col.SourceType.ToLower();
            switch (type)
            {
                case "int":
                case "integer":
                    return "integer";
                case "bigint":
                    return "bigint";
                case "smallint":
                    return "smallint";
                case "tinyint":
                    return "smallint"; // Postgres doesn't support 1-byte int
                case "bit":
                    return "boolean";
                case "varchar":
                    return col.MaxLength == -1 ? "text" : $"varchar({col.MaxLength})";
                case "nvarchar":
                    return col.MaxLength == -1 ? "text" : $"varchar({col.MaxLength})";
                case "char":
                    return $"char({col.MaxLength})";
                case "nchar":
                    return $"char({col.MaxLength})";
                case "text":
                case "ntext":
                    return "text";
                case "datetime":
                case "datetime2":
                case "smalldatetime":
                    return "timestamp without time zone";
                case "datetimeoffset":
                    return "timestamp with time zone";
                case "date":
                    return "date";
                case "time":
                    return "time without time zone";
                case "decimal":
                case "numeric":
                    return $"numeric({col.Precision},{col.Scale})";
                case "money":
                case "smallmoney":
                    return "numeric(19,4)";
                case "float":
                    return "double precision";
                case "real":
                    return "real";
                case "uniqueidentifier":
                    return "uuid";
                case "binary":
                case "varbinary":
                case "image":
                    return "bytea";
                case "xml":
                    return "xml";
                default:
                    return "text"; // Fallback safe type
            }
        }
    }
}
