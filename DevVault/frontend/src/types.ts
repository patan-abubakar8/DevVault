export interface ColumnMetadata {
  name: string;
  sourceType: string;
  targetType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isIdentity: boolean;
  defaultValue: string | null;
  maxLength: number | null;
  precision: number | null;
  scale: number | null;
}

export interface ForeignKeyMetadata {
  constraintName: string;
  tableName: string;
  columns: string[];
  referencedTableName: string;
  referencedColumns: string[];
  onDeleteAction: string;
  onUpdateAction: string;
}

export interface IndexMetadata {
  indexName: string;
  columns: string[];
  isUnique: boolean;
  isPrimaryKey: boolean;
}

export interface TableMetadata {
  schemaName: string;
  tableName: string;
  fullName: string;
  rowCount: number;
  columns: ColumnMetadata[];
  foreignKeys: ForeignKeyMetadata[];
  indexes: IndexMetadata[];
}

export interface SchemaAnalysisResult {
  tables: TableMetadata[];
}

export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
}

export interface TableProgress {
  tableName: string;
  rowsMigrated: number;
  totalRows: number;
  status: 'Pending' | 'Copying' | 'Completed' | 'Failed';
  speed: number;
}

export interface MigrationProgress {
  phase: 'Idle' | 'Analyzing' | 'SchemaCreation' | 'DataCopy' | 'Constraints' | 'Complete' | 'Failed';
  completedTables: number;
  totalTables: number;
  tableMetrics: TableProgress[];
  recentLogs: LogEntry[];
  overallProgress: number;
  startTime: string | null;
  endTime: string | null;
  errorMessage: string | null;
  isRunning: boolean;
}
