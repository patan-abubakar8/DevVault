using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using Npgsql;
using DBMigrator.Api.Models;

namespace DBMigrator.Api.Services
{
    public interface IPostgresMetadataReader
    {
        bool TestConnection(string connectionString, out string error);
        SchemaAnalysisResult AnalyzeSchema(string connectionString);
    }

    public class PostgresMetadataReader : IPostgresMetadataReader
    {
        public bool TestConnection(string connectionString, out string error)
        {
            try
            {
                using var conn = new NpgsqlConnection(connectionString);
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

            using (var conn = new NpgsqlConnection(connectionString))
            {
                conn.Open();

                // 1. Get Tables and Row Counts using pg_stat_user_tables
                string tablesQuery = @"
                    SELECT 
                        schemaname AS SchemaName,
                        relname AS TableName,
                        n_live_tup AS RowCount
                    FROM 
                        pg_stat_user_tables
                    ORDER BY 
                        schemaname, relname;";

                using (var cmd = new NpgsqlCommand(tablesQuery, conn))
                using (var reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        var schema = reader.GetString(0);
                        var name = reader.GetString(1);
                        var rows = reader.GetInt64(2);

                        if (rows < 0) rows = 0;

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

                // Fallback to information_schema if no user tables found in stats table
                if (result.Tables.Count == 0)
                {
                    string infoSchemaQuery = @"
                        SELECT table_schema, table_name
                        FROM information_schema.tables
                        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
                          AND table_type = 'BASE TABLE'
                        ORDER BY table_schema, table_name;";
                    
                    using (var cmd = new NpgsqlCommand(infoSchemaQuery, conn))
                    using (var reader = cmd.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            var schema = reader.GetString(0);
                            var name = reader.GetString(1);
                            
                            var tableMeta = new TableMetadata
                            {
                                SchemaName = schema,
                                TableName = name,
                                RowCount = 0
                            };

                            tablesMap[$"{schema}.{name}"] = tableMeta;
                            result.Tables.Add(tableMeta);
                        }
                    }
                }

                // 2. Get Columns and Details
                string columnsQuery = @"
                    SELECT 
                        table_schema AS SchemaName,
                        table_name AS TableName,
                        column_name AS ColumnName,
                        data_type AS DataType,
                        is_nullable AS IsNullable,
                        column_default AS DefaultValue,
                        character_maximum_length AS MaxLength,
                        numeric_precision AS Precision,
                        numeric_scale AS Scale,
                        CASE WHEN is_identity = 'YES' THEN 1 ELSE 0 END AS IsIdentity,
                        udt_name AS UdtName
                    FROM 
                        information_schema.columns
                    WHERE 
                        table_schema NOT IN ('pg_catalog', 'information_schema')
                    ORDER BY 
                        table_schema, table_name, ordinal_position;";

                // Fetch primary keys to map col.IsPrimaryKey
                var pkCols = new HashSet<string>();
                string pkQuery = @"
                    SELECT 
                        kcu.table_schema || '.' || kcu.table_name || '.' || kcu.column_name AS PkKey
                    FROM 
                        information_schema.table_constraints tc
                    JOIN 
                        information_schema.key_column_usage kcu 
                        ON tc.constraint_name = kcu.constraint_name
                        AND tc.table_schema = kcu.table_schema
                    WHERE 
                        tc.constraint_type = 'PRIMARY KEY';";

                using (var cmd = new NpgsqlCommand(pkQuery, conn))
                using (var reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        pkCols.Add(reader.GetString(0));
                    }
                }

                using (var cmd = new NpgsqlCommand(columnsQuery, conn))
                using (var reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        var schema = reader.GetString(0);
                        var table = reader.GetString(1);
                        var colName = reader.GetString(2);
                        var key = $"{schema}.{table}";

                        if (tablesMap.TryGetValue(key, out var tableMeta))
                        {
                            var dataType = reader.GetString(3);
                            var isNullable = reader.GetString(4).Equals("YES", StringComparison.OrdinalIgnoreCase);
                            
                            string? defVal = reader.IsDBNull(5) ? null : reader.GetString(5);
                            int? maxLen = reader.IsDBNull(6) ? null : reader.GetInt32(6);
                            int? prec = reader.IsDBNull(7) ? null : reader.GetInt32(7);
                            int? scale = reader.IsDBNull(8) ? null : reader.GetInt32(8);
                            var isIdentity = reader.GetInt32(9) == 1;
                            var udtName = reader.GetString(10);

                            var sourceDataType = dataType.Equals("USER-DEFINED", StringComparison.OrdinalIgnoreCase) ? udtName : dataType;

                            var col = new ColumnMetadata
                            {
                                Name = colName,
                                SourceType = sourceDataType,
                                IsNullable = isNullable,
                                IsIdentity = isIdentity,
                                MaxLength = maxLen,
                                Precision = prec,
                                Scale = scale,
                                DefaultValue = defVal,
                                IsPrimaryKey = pkCols.Contains($"{schema}.{table}.{colName}")
                            };

                            col.TargetType = MapToSqlServerType(col);
                            tableMeta.Columns.Add(col);
                        }
                    }
                }

                // 3. Get Foreign Keys
                string fkQuery = @"
                    SELECT 
                        tc.constraint_name AS ConstraintName,
                        tc.table_schema AS SchemaName,
                        tc.table_name AS TableName,
                        kcu.column_name AS ColumnName,
                        ccu.table_schema AS ReferencedSchemaName,
                        ccu.table_name AS ReferencedTableName,
                        ccu.column_name AS ReferencedColumnName,
                        rc.delete_rule AS OnDeleteAction,
                        rc.update_rule AS OnUpdateAction
                    FROM 
                        information_schema.table_constraints tc
                    JOIN 
                        information_schema.key_column_usage kcu 
                        ON tc.constraint_name = kcu.constraint_name
                        AND tc.table_schema = kcu.table_schema
                    JOIN 
                        information_schema.referential_constraints rc
                        ON tc.constraint_name = rc.constraint_name
                    JOIN 
                        information_schema.constraint_column_usage ccu
                        ON rc.unique_constraint_name = ccu.constraint_name
                    WHERE 
                        tc.constraint_type = 'FOREIGN KEY'
                    ORDER BY 
                        tc.constraint_name, kcu.position_in_unique_constraint;";

                var fkDict = new Dictionary<string, ForeignKeyMetadata>();

                using (var cmd = new NpgsqlCommand(fkQuery, conn))
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
                        var deleteAction = reader.GetString(7);
                        var updateAction = reader.GetString(8);

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

                // 4. Get Indexes (excluding Primary Keys)
                string indexesQuery = @"
                    SELECT 
                        schemaname AS SchemaName,
                        tablename AS TableName,
                        indexname AS IndexName,
                        indexdef AS IndexDef
                    FROM 
                        pg_indexes
                    WHERE 
                        schemaname NOT IN ('pg_catalog', 'information_schema')
                    ORDER BY 
                        schemaname, tablename, indexname;";

                using (var cmd = new NpgsqlCommand(indexesQuery, conn))
                using (var reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        var schema = reader.GetString(0);
                        var table = reader.GetString(1);
                        var indexName = reader.GetString(2);
                        var indexDef = reader.GetString(3);

                        if (indexName.EndsWith("_pkey", StringComparison.OrdinalIgnoreCase))
                        {
                            continue;
                        }

                        var tableKey = $"{schema}.{table}";
                        if (tablesMap.TryGetValue(tableKey, out var parentTable))
                        {
                            var isUnique = indexDef.Contains("UNIQUE", StringComparison.OrdinalIgnoreCase);
                            
                            var cols = new List<string>();
                            int openParen = indexDef.LastIndexOf('(');
                            int closeParen = indexDef.LastIndexOf(')');
                            if (openParen != -1 && closeParen != -1 && closeParen > openParen)
                            {
                                var colsRaw = indexDef.Substring(openParen + 1, closeParen - openParen - 1);
                                cols = colsRaw.Split(',').Select(c => c.Trim().Replace("\"", "")).ToList();
                            }

                            if (cols.Any())
                            {
                                var idxMeta = new IndexMetadata
                                {
                                    IndexName = indexName,
                                    IsUnique = isUnique,
                                    IsPrimaryKey = false,
                                    Columns = cols
                                };
                                parentTable.Indexes.Add(idxMeta);
                            }
                        }
                    }
                }
            }

            return result;
        }

        private string MapToSqlServerType(ColumnMetadata col)
        {
            var type = col.SourceType.ToLower();
            switch (type)
            {
                case "integer":
                case "int4":
                case "int":
                    return "int";
                case "bigint":
                case "int8":
                    return "bigint";
                case "smallint":
                case "int2":
                    return "smallint";
                case "boolean":
                case "bool":
                    return "bit";
                case "character varying":
                case "varchar":
                    return col.MaxLength == -1 || col.MaxLength == null ? "nvarchar(max)" : $"nvarchar({col.MaxLength})";
                case "text":
                    return "nvarchar(max)";
                case "character":
                case "char":
                    return $"nchar({col.MaxLength ?? 1})";
                case "timestamp without time zone":
                case "timestamp":
                    return "datetime2";
                case "timestamp with time zone":
                case "timestamptz":
                    return "datetimeoffset";
                case "date":
                    return "date";
                case "time without time zone":
                case "time":
                    return "time";
                case "numeric":
                case "decimal":
                    return col.Precision != null && col.Scale != null ? $"numeric({col.Precision},{col.Scale})" : "numeric(18,2)";
                case "double precision":
                case "float8":
                    return "float";
                case "real":
                case "float4":
                    return "real";
                case "uuid":
                    return "uniqueidentifier";
                case "bytea":
                    return "varbinary(max)";
                case "xml":
                    return "xml";
                default:
                    return "nvarchar(max)";
            }
        }
    }
}
