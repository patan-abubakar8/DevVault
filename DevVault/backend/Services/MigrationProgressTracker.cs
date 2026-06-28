using System;
using System.Collections.Generic;
using System.Linq;
using DBMigrator.Api.Models;

namespace DBMigrator.Api.Services
{
    public interface IMigrationProgressTracker
    {
        event Action<MigrationProgress>? OnProgressUpdated;
        void StartMigration(List<TableMetadata> tables);
        void SetPhase(string phase);
        void UpdateTableProgress(string tableName, long rowsMigrated, string status, double speed);
        void AddLog(string message, string level = "INFO");
        void CompleteMigration();
        void FailMigration(string errorMessage);
        MigrationProgress GetProgress();
        void Reset();
    }

    public class MigrationProgressTracker : IMigrationProgressTracker
    {
        private readonly object _lock = new();
        private readonly MigrationProgress _progress = new();
        private const int MaxLogs = 200; // Keep the response payload size managed

        public event Action<MigrationProgress>? OnProgressUpdated;

        public void Reset()
        {
            lock (_lock)
            {
                _progress.Phase = "Idle";
                _progress.CompletedTables = 0;
                _progress.TotalTables = 0;
                _progress.TableMetrics.Clear();
                _progress.RecentLogs.Clear();
                _progress.OverallProgress = 0;
                _progress.StartTime = null;
                _progress.EndTime = null;
                _progress.ErrorMessage = null;
                _progress.IsRunning = false;
            }
            NotifyUpdate();
        }

        public void StartMigration(List<TableMetadata> tables)
        {
            lock (_lock)
            {
                _progress.Phase = "Initializing";
                _progress.StartTime = DateTime.UtcNow;
                _progress.EndTime = null;
                _progress.IsRunning = true;
                _progress.ErrorMessage = null;
                _progress.CompletedTables = 0;
                _progress.TotalTables = tables.Count;
                _progress.OverallProgress = 0;
                
                _progress.TableMetrics = tables.Select(t => new TableProgress
                {
                    TableName = $"{t.SchemaName}.{t.TableName}",
                    RowsMigrated = 0,
                    TotalRows = t.RowCount,
                    Status = "Pending",
                    Speed = 0
                }).ToList();

                _progress.RecentLogs.Clear();
                _progress.RecentLogs.Add(new LogEntry { Message = "Migration started. Analyzing source schemas...", Level = "INFO" });
            }
            NotifyUpdate();
        }

        public void SetPhase(string phase)
        {
            lock (_lock)
            {
                _progress.Phase = phase;
                AddLogInternal($"Entering migration phase: {phase}", "INFO");
            }
            NotifyUpdate();
        }

        public void UpdateTableProgress(string tableName, long rowsMigrated, string status, double speed)
        {
            lock (_lock)
            {
                var metric = _progress.TableMetrics.FirstOrDefault(m => m.TableName.Equals(tableName, StringComparison.OrdinalIgnoreCase));
                if (metric != null)
                {
                    metric.RowsMigrated = rowsMigrated;
                    metric.Status = status;
                    metric.Speed = speed;

                    if (status == "Completed" && _progress.TableMetrics.Any(m => m.TableName.Equals(tableName) && m.Status != "Completed"))
                    {
                        // Safely handle state transition
                    }
                }

                // Calculate completed count
                _progress.CompletedTables = _progress.TableMetrics.Count(m => m.Status == "Completed");

                // Calculate overall progress
                long totalRowsToMigrate = _progress.TableMetrics.Sum(m => m.TotalRows);
                if (totalRowsToMigrate > 0)
                {
                    long totalRowsMigrated = _progress.TableMetrics.Sum(m => m.RowsMigrated);
                    _progress.OverallProgress = (double)totalRowsMigrated / totalRowsToMigrate * 100.0;
                }
                else
                {
                    // If all tables are empty, use table counts
                    _progress.OverallProgress = _progress.TotalTables > 0 
                        ? (double)_progress.CompletedTables / _progress.TotalTables * 100.0 
                        : 100.0;
                }

                // Cap progress at 99% until phase is "Complete" to allow for constraint builds
                if (_progress.Phase != "Complete" && _progress.OverallProgress >= 100.0)
                {
                    _progress.OverallProgress = 99.9;
                }
            }
            NotifyUpdate();
        }

        public void AddLog(string message, string level = "INFO")
        {
            lock (_lock)
            {
                AddLogInternal(message, level);
            }
            NotifyUpdate();
        }

        private void AddLogInternal(string message, string level)
        {
            _progress.RecentLogs.Add(new LogEntry
            {
                Timestamp = DateTime.UtcNow,
                Level = level,
                Message = message
            });

            if (_progress.RecentLogs.Count > MaxLogs)
            {
                _progress.RecentLogs.RemoveAt(0);
            }
        }

        public void CompleteMigration()
        {
            lock (_lock)
            {
                _progress.Phase = "Complete";
                _progress.EndTime = DateTime.UtcNow;
                _progress.IsRunning = false;
                _progress.OverallProgress = 100.0;
                
                foreach (var m in _progress.TableMetrics)
                {
                    if (m.Status == "Copying" || m.Status == "Pending")
                    {
                        m.Status = "Completed";
                    }
                }

                AddLogInternal("Migration completed successfully!", "INFO");
            }
            NotifyUpdate();
        }

        public void FailMigration(string errorMessage)
        {
            lock (_lock)
            {
                _progress.Phase = "Failed";
                _progress.EndTime = DateTime.UtcNow;
                _progress.IsRunning = false;
                _progress.ErrorMessage = errorMessage;
                AddLogInternal($"Migration failed: {errorMessage}", "ERROR");
            }
            NotifyUpdate();
        }

        public MigrationProgress GetProgress()
        {
            lock (_lock)
            {
                // Return a deep copy to prevent multi-threading exceptions when serializing
                return new MigrationProgress
                {
                    Phase = _progress.Phase,
                    CompletedTables = _progress.CompletedTables,
                    TotalTables = _progress.TotalTables,
                    OverallProgress = _progress.OverallProgress,
                    StartTime = _progress.StartTime,
                    EndTime = _progress.EndTime,
                    ErrorMessage = _progress.ErrorMessage,
                    IsRunning = _progress.IsRunning,
                    RecentLogs = new List<LogEntry>(_progress.RecentLogs),
                    TableMetrics = _progress.TableMetrics.Select(m => new TableProgress
                    {
                        TableName = m.TableName,
                        RowsMigrated = m.RowsMigrated,
                        TotalRows = m.TotalRows,
                        Status = m.Status,
                        Speed = m.Speed
                    }).ToList()
                };
            }
        }

        private void NotifyUpdate()
        {
            var currentProgress = GetProgress();
            OnProgressUpdated?.Invoke(currentProgress);
        }
    }
}
