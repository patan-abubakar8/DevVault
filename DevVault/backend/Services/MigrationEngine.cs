using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using DBMigrator.Api.Models;

namespace DBMigrator.Api.Services
{
    public interface IMigrationEngine
    {
        bool StartMigration(MigrationRequest request);
        void CancelMigration();
        bool IsRunning { get; }
    }

    public class MigrationEngine : IMigrationEngine
    {
        private readonly ISqlServerMetadataReader _metadataReader;
        private readonly IPostgresWriter _postgresWriter;
        private readonly IMigrationProgressTracker _progressTracker;
        
        private CancellationTokenSource? _cts;
        private readonly object _lock = new();
        private bool _isRunning = false;

        public bool IsRunning => _isRunning;

        public MigrationEngine(
            ISqlServerMetadataReader metadataReader,
            IPostgresWriter postgresWriter,
            IMigrationProgressTracker progressTracker)
        {
            _metadataReader = metadataReader;
            _postgresWriter = postgresWriter;
            _progressTracker = progressTracker;
        }

        public bool StartMigration(MigrationRequest request)
        {
            lock (_lock)
            {
                if (_isRunning)
                {
                    return false;
                }

                _isRunning = true;
                _cts = new CancellationTokenSource();
            }

            // Execute in background
            _ = Task.Run(() => RunMigrationInternalAsync(request, _cts.Token));
            return true;
        }

        public void CancelMigration()
        {
            lock (_lock)
            {
                if (_isRunning && _cts != null)
                {
                    _progressTracker.AddLog("Cancellation requested by user. Terminating process...", "WARN");
                    _cts.Cancel();
                }
            }
        }

        private async Task RunMigrationInternalAsync(MigrationRequest request, CancellationToken cancellationToken)
        {
            try
            {
                _progressTracker.Reset();
                _progressTracker.AddLog("Starting SQL Server to PostgreSQL Migration pipeline...", "INFO");

                // 1. Analyze schema of source tables
                _progressTracker.SetPhase("Analyzing");
                _progressTracker.AddLog("Reading metadata from SQL Server source database...", "INFO");

                SchemaAnalysisResult sourceSchema;
                try
                {
                    sourceSchema = _metadataReader.AnalyzeSchema(request.SourceConnectionString);
                }
                catch (Exception ex)
                {
                    throw new Exception($"Failed to connect or analyze SQL Server database: {ex.Message}");
                }

                // Filter source tables based on selection
                var selectedTables = sourceSchema.Tables
                    .Where(t => request.SelectedTables.Contains($"{t.SchemaName}.{t.TableName}", StringComparer.OrdinalIgnoreCase))
                    .ToList();

                if (!selectedTables.Any())
                {
                    throw new Exception("No tables were selected for migration, or selected tables do not exist in source schema.");
                }

                _progressTracker.StartMigration(selectedTables);
                _progressTracker.AddLog($"Selected {selectedTables.Count} table(s) for migration.", "INFO");

                // 2. Schema Creation Phase
                _progressTracker.SetPhase("SchemaCreation");
                _progressTracker.AddLog("Generating DDL and building table structures in target PostgreSQL database...", "INFO");

                try
                {
                    await _postgresWriter.PrepareTargetSchemaAsync(
                        request.TargetConnectionString, 
                        selectedTables, 
                        request.CleanTarget, 
                        (msg, lvl) => _progressTracker.AddLog(msg, lvl));
                }
                catch (Exception ex)
                {
                    throw new Exception($"Failed to prepare PostgreSQL target schema: {ex.Message}");
                }

                cancellationToken.ThrowIfCancellationRequested();

                // 3. Data Transfer Phase (Sequential table migration to prevent connection starvation and ensure ordered log streaming)
                _progressTracker.SetPhase("DataCopy");
                _progressTracker.AddLog("Beginning bulk binary COPY operations for table data...", "INFO");

                for (int i = 0; i < selectedTables.Count; i++)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    var table = selectedTables[i];
                    var tableFullName = $"{table.SchemaName}.{table.TableName}";

                    _progressTracker.AddLog($"Migrating data for table {tableFullName} (Rows: {table.RowCount:N0})...", "INFO");
                    _progressTracker.UpdateTableProgress(tableFullName, 0, "Copying", 0);

                    var stopwatch = Stopwatch.StartNew();

                    try
                    {
                        await _postgresWriter.MigrateTableDataAsync(
                            request.SourceConnectionString,
                            request.TargetConnectionString,
                            table,
                            (rowsCopied) =>
                            {
                                var elapsedSec = stopwatch.Elapsed.TotalSeconds;
                                double speed = elapsedSec > 0.05 ? rowsCopied / elapsedSec : 0;
                                _progressTracker.UpdateTableProgress(tableFullName, rowsCopied, "Copying", speed);
                            },
                            (msg, lvl) => _progressTracker.AddLog(msg, lvl),
                            cancellationToken
                        );

                        stopwatch.Stop();
                        _progressTracker.UpdateTableProgress(tableFullName, table.RowCount, "Completed", 0);
                        _progressTracker.AddLog($"Completed data migration for {tableFullName} in {stopwatch.Elapsed.TotalSeconds:F2}s", "INFO");
                    }
                    catch (OperationCanceledException)
                    {
                        _progressTracker.UpdateTableProgress(tableFullName, 0, "Failed", 0);
                        throw;
                    }
                    catch (Exception ex)
                    {
                        _progressTracker.UpdateTableProgress(tableFullName, 0, "Failed", 0);
                        _progressTracker.AddLog($"Data copy failed for table {tableFullName}: {ex.Message}", "ERROR");
                        throw new Exception($"Data copy failed for table {tableFullName}: {ex.Message}");
                    }
                }

                cancellationToken.ThrowIfCancellationRequested();

                // 4. Constraints and Index Application Phase
                _progressTracker.SetPhase("Constraints");
                _progressTracker.AddLog("Rebuilding indexes, primary keys, foreign keys, and syncing sequence counters...", "INFO");

                try
                {
                    await _postgresWriter.ApplyPostDataConstraintsAsync(
                        request.TargetConnectionString,
                        selectedTables,
                        (msg, lvl) => _progressTracker.AddLog(msg, lvl)
                    );
                }
                catch (Exception ex)
                {
                    throw new Exception($"Failed to apply post-data constraints: {ex.Message}");
                }

                // Complete
                _progressTracker.CompleteMigration();
                _progressTracker.AddLog("Database migration pipeline executed successfully!", "INFO");
            }
            catch (OperationCanceledException)
            {
                _progressTracker.FailMigration("Migration cancelled by user.");
            }
            catch (Exception ex)
            {
                _progressTracker.FailMigration(ex.Message);
            }
            finally
            {
                lock (_lock)
                {
                    _isRunning = false;
                    _cts?.Dispose();
                    _cts = null;
                }
            }
        }
    }
}
