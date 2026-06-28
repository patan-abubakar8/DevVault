using System;
using System.Collections.Generic;

namespace DBMigrator.Api.Models
{
    public class ConnectionRequest
    {
        public string ConnectionString { get; set; } = string.Empty;
    }

    public class MigrationRequest
    {
        public string SourceConnectionString { get; set; } = string.Empty;
        public string TargetConnectionString { get; set; } = string.Empty;
        public List<string> SelectedTables { get; set; } = new();
        public bool CleanTarget { get; set; } = false;
    }

    public class ColumnMetadata
    {
        public string Name { get; set; } = string.Empty;
        public string SourceType { get; set; } = string.Empty;
        public string TargetType { get; set; } = string.Empty;
        public bool IsNullable { get; set; }
        public bool IsPrimaryKey { get; set; }
        public bool IsIdentity { get; set; }
        public string? DefaultValue { get; set; }
        public int? MaxLength { get; set; }
        public int? Precision { get; set; }
        public int? Scale { get; set; }
    }

    public class ForeignKeyMetadata
    {
        public string ConstraintName { get; set; } = string.Empty;
        public string TableName { get; set; } = string.Empty;
        public List<string> Columns { get; set; } = new();
        public string ReferencedTableName { get; set; } = string.Empty;
        public List<string> ReferencedColumns { get; set; } = new();
        public string OnDeleteAction { get; set; } = "NO ACTION";
        public string OnUpdateAction { get; set; } = "NO ACTION";
    }

    public class IndexMetadata
    {
        public string IndexName { get; set; } = string.Empty;
        public List<string> Columns { get; set; } = new();
        public bool IsUnique { get; set; }
        public bool IsPrimaryKey { get; set; }
    }

    public class TableMetadata
    {
        public string SchemaName { get; set; } = "dbo";
        public string TableName { get; set; } = string.Empty;
        public string FullName => $"[{SchemaName}].[{TableName}]";
        public long RowCount { get; set; }
        public List<ColumnMetadata> Columns { get; set; } = new();
        public List<ForeignKeyMetadata> ForeignKeys { get; set; } = new();
        public List<IndexMetadata> Indexes { get; set; } = new();
    }

    public class SchemaAnalysisResult
    {
        public List<TableMetadata> Tables { get; set; } = new();
    }

    public class LogEntry
    {
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public string Level { get; set; } = "INFO"; // INFO, WARN, ERROR
        public string Message { get; set; } = string.Empty;
    }

    public class TableProgress
    {
        public string TableName { get; set; } = string.Empty;
        public long RowsMigrated { get; set; }
        public long TotalRows { get; set; }
        public string Status { get; set; } = "Pending"; // Pending, Copying, Completed, Failed
        public double Speed { get; set; } // rows per second
    }

    public class MigrationProgress
    {
        public string Phase { get; set; } = "Idle"; // Idle, Analyzing, SchemaCreation, DataCopy, Constraints, Complete, Failed
        public int CompletedTables { get; set; }
        public int TotalTables { get; set; }
        public List<TableProgress> TableMetrics { get; set; } = new();
        public List<LogEntry> RecentLogs { get; set; } = new();
        public double OverallProgress { get; set; } // 0 to 100
        public DateTime? StartTime { get; set; }
        public DateTime? EndTime { get; set; }
        public string? ErrorMessage { get; set; }
        public bool IsRunning { get; set; }
    }
}
