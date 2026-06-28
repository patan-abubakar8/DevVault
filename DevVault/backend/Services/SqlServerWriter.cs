using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Data.SqlClient;
using Npgsql;
using DBMigrator.Api.Models;

namespace DBMigrator.Api.Services
{
    public interface ISqlServerWriter
    {
        bool TestConnection(string connectionString, out string error);
        Task PrepareTargetSchemaAsync(string connectionString, List<TableMetadata> tables, bool cleanTarget, Action<string, string> logCallback);
        Task MigrateTableDataAsync(string postgresConnStr, string sqlServerConnStr, TableMetadata table, Action<long> progressCallback, Action<string, string> logCallback, CancellationToken cancellationToken);
        Task ApplyPostDataConstraintsAsync(string connectionString, List<TableMetadata> tables, Action<string, string> logCallback);
    }

    public class SqlServerWriter : ISqlServerWriter
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

        private string Quote(string name) => $"[{name}]";
        private string QuoteTable(string schema, string table) => $"[{schema}].[{table}]";

        public async Task PrepareTargetSchemaAsync(string connectionString, List<TableMetadata> tables, bool cleanTarget, Action<string, string> logCallback)
        {
            using var conn = new SqlConnection(connectionString);
            await conn.OpenAsync();

            // 1. Ensure schemas exist
            var schemas = tables.Select(t => t.SchemaName).Distinct();
            foreach (var schema in schemas)
            {
                if (schema.Equals("dbo", StringComparison.OrdinalIgnoreCase)) continue;

                logCallback($"Creating schema [{schema}] if it does not exist...", "INFO");
                var schemaCheckQuery = $@"
                    IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = '{schema}')
                    BEGIN
                        EXEC('CREATE SCHEMA [{schema}]')
                    END";
                
                using var cmd = new SqlCommand(schemaCheckQuery, conn);
                await cmd.ExecuteNonQueryAsync();
            }

            // 2. Drop existing foreign keys and tables if clean requested
            if (cleanTarget)
            {
                logCallback("Cleaning target SQL Server database. Dropping existing tables...", "WARN");
                
                foreach (var table in tables)
                {
                    foreach (var fk in table.ForeignKeys)
                    {
                        var dropFkQuery = $@"
                            IF OBJECT_ID('{QuoteTable(table.SchemaName, table.TableName)}', 'U') IS NOT NULL
                            AND OBJECT_ID('{fk.ConstraintName}', 'F') IS NOT NULL
                            BEGIN
                                ALTER TABLE {QuoteTable(table.SchemaName, table.TableName)} DROP CONSTRAINT {Quote(fk.ConstraintName)};
                            END";
                        using var cmd = new SqlCommand(dropFkQuery, conn);
                        await cmd.ExecuteNonQueryAsync();
                    }
                }

                for (int i = tables.Count - 1; i >= 0; i--)
                {
                    var table = tables[i];
                    var dropQuery = $@"
                        IF OBJECT_ID('{QuoteTable(table.SchemaName, table.TableName)}', 'U') IS NOT NULL
                        BEGIN
                            DROP TABLE {QuoteTable(table.SchemaName, table.TableName)};
                        END";
                    using var cmd = new SqlCommand(dropQuery, conn);
                    await cmd.ExecuteNonQueryAsync();
                }
            }

            // 3. Create tables with columns and primary keys
            foreach (var table in tables)
            {
                logCallback($"Creating table {table.SchemaName}.{table.TableName}...", "INFO");

                var columnDefs = new List<string>();
                var primaryKeyCols = new List<string>();

                foreach (var col in table.Columns)
                {
                    var colDef = $"{Quote(col.Name)} {col.TargetType}";

                    if (col.IsIdentity)
                    {
                        colDef += " IDENTITY(1,1)";
                    }

                    if (!col.IsNullable)
                    {
                        colDef += " NOT NULL";
                    }
                    else
                    {
                        colDef += " NULL";
                    }

                    columnDefs.Add(colDef);

                    if (col.IsPrimaryKey)
                    {
                        primaryKeyCols.Add(Quote(col.Name));
                    }
                }

                if (primaryKeyCols.Any())
                {
                    var pkConstraintName = $"PK_{table.TableName}";
                    columnDefs.Add($"CONSTRAINT {Quote(pkConstraintName)} PRIMARY KEY ({string.Join(", ", primaryKeyCols)})");
                }

                var createQuery = $@"
                    CREATE TABLE {QuoteTable(table.SchemaName, table.TableName)} (
                        {string.Join(",\n                        ", columnDefs)}
                    );";

                using var cmd = new SqlCommand(createQuery, conn);
                await cmd.ExecuteNonQueryAsync();
            }
        }

        public async Task MigrateTableDataAsync(
            string postgresConnStr,
            string sqlServerConnStr,
            TableMetadata table,
            Action<long> progressCallback,
            Action<string, string> logCallback,
            CancellationToken cancellationToken)
        {
            using var pgConn = new NpgsqlConnection(postgresConnStr);
            await pgConn.OpenAsync(cancellationToken);

            var colNames = table.Columns.Select(c => $"\"{c.Name}\"").ToList();
            var selectCols = string.Join(", ", colNames);
            var pgQuery = $"SELECT {selectCols} FROM \"{table.SchemaName}\".\"{table.TableName}\"";
            
            using var pgCmd = new NpgsqlCommand(pgQuery, pgConn);
            using var reader = await pgCmd.ExecuteReaderAsync(cancellationToken);

            using var bulkCopy = new SqlBulkCopy(sqlServerConnStr, SqlBulkCopyOptions.KeepIdentity)
            {
                DestinationTableName = QuoteTable(table.SchemaName, table.TableName),
                BulkCopyTimeout = 600,
                BatchSize = 5000
            };

            foreach (var col in table.Columns)
            {
                bulkCopy.ColumnMappings.Add(col.Name, col.Name);
            }

            long rowsCopied = 0;
            bulkCopy.NotifyAfter = 1000;
            bulkCopy.SqlRowsCopied += (sender, e) =>
            {
                rowsCopied = e.RowsCopied;
                progressCallback(rowsCopied);
            };

            await bulkCopy.WriteToServerAsync(reader, cancellationToken);
            progressCallback(rowsCopied);
            logCallback($"Successfully bulk-copied {rowsCopied:N0} rows into {table.SchemaName}.{table.TableName}", "INFO");
        }

        public async Task ApplyPostDataConstraintsAsync(string connectionString, List<TableMetadata> tables, Action<string, string> logCallback)
        {
            using var conn = new SqlConnection(connectionString);
            await conn.OpenAsync();

            // 1. Recreate Indexes
            foreach (var table in tables)
            {
                foreach (var index in table.Indexes)
                {
                    logCallback($"Applying Index {index.IndexName} on {table.SchemaName}.{table.TableName}...", "INFO");
                    
                    var colsStr = string.Join(", ", index.Columns.Select(Quote));
                    var uniqueKeyword = index.IsUnique ? "UNIQUE " : "";
                    
                    var indexQuery = $"CREATE {uniqueKeyword}INDEX {Quote(index.IndexName)} ON {QuoteTable(table.SchemaName, table.TableName)} ({colsStr});";
                    
                    try
                    {
                        using var cmd = new SqlCommand(indexQuery, conn);
                        await cmd.ExecuteNonQueryAsync();
                    }
                    catch (Exception ex)
                    {
                        logCallback($"Failed to apply index {index.IndexName}: {ex.Message}", "WARN");
                    }
                }
            }

            // 2. Recreate Foreign Keys
            foreach (var table in tables)
            {
                foreach (var fk in table.ForeignKeys)
                {
                    logCallback($"Applying Foreign Key {fk.ConstraintName} on {table.SchemaName}.{table.TableName}...", "INFO");

                    var colsStr = string.Join(", ", fk.Columns.Select(Quote));
                    
                    var refParts = fk.ReferencedTableName.Split('.');
                    var refSchema = refParts.Length > 1 ? refParts[0] : "dbo";
                    var refTable = refParts.Length > 1 ? refParts[1] : refParts[0];

                    var refColsStr = string.Join(", ", fk.ReferencedColumns.Select(Quote));

                    var fkQuery = $@"
                        ALTER TABLE {QuoteTable(table.SchemaName, table.TableName)}
                        ADD CONSTRAINT {Quote(fk.ConstraintName)}
                        FOREIGN KEY ({colsStr})
                        REFERENCES {QuoteTable(refSchema, refTable)} ({refColsStr})
                        ON DELETE {fk.OnDeleteAction}
                        ON UPDATE {fk.OnUpdateAction};";

                    try
                    {
                        using var cmd = new SqlCommand(fkQuery, conn);
                        await cmd.ExecuteNonQueryAsync();
                    }
                    catch (Exception ex)
                    {
                        logCallback($"Failed to apply foreign key {fk.ConstraintName}: {ex.Message}", "WARN");
                    }
                }
            }
        }
    }
}
