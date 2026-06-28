using System;
using System.IO;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using DBMigrator.Api.Models;
using DBMigrator.Api.Services;

namespace DBMigrator.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class MigrationController : ControllerBase
    {
        private readonly ISqlServerMetadataReader _metadataReader;
        private readonly IMigrationEngine _migrationEngine;
        private readonly IMigrationProgressTracker _progressTracker;

        public MigrationController(
            ISqlServerMetadataReader metadataReader,
            IMigrationEngine migrationEngine,
            IMigrationProgressTracker progressTracker)
        {
            _metadataReader = metadataReader;
            _migrationEngine = migrationEngine;
            _progressTracker = progressTracker;
        }

        [HttpPost("analyze")]
        public IActionResult Analyze([FromBody] ConnectionRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.ConnectionString))
            {
                return BadRequest(new { success = false, message = "Connection string is required" });
            }

            try
            {
                var schema = _metadataReader.AnalyzeSchema(request.ConnectionString);
                return Ok(new { success = true, data = schema });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Analysis failed", error = ex.Message });
            }
        }

        [HttpPost("start")]
        public IActionResult Start([FromBody] MigrationRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.SourceConnectionString) || string.IsNullOrWhiteSpace(request.TargetConnectionString))
            {
                return BadRequest(new { success = false, message = "Source and Target connection strings are required." });
            }

            if (request.SelectedTables == null || request.SelectedTables.Count == 0)
            {
                return BadRequest(new { success = false, message = "At least one table must be selected for migration." });
            }

            bool success = _migrationEngine.StartMigration(request);
            if (success)
            {
                return Ok(new { success = true, message = "Migration pipeline initiated successfully." });
            }

            return Conflict(new { success = false, message = "A database migration is already running." });
        }

        [HttpPost("cancel")]
        public IActionResult Cancel()
        {
            if (!_migrationEngine.IsRunning)
            {
                return BadRequest(new { success = false, message = "No active database migration to cancel." });
            }

            _migrationEngine.CancelMigration();
            return Ok(new { success = true, message = "Cancellation request dispatched successfully." });
        }

        [HttpGet("status")]
        public IActionResult GetStatus()
        {
            var progress = _progressTracker.GetProgress();
            return Ok(new { success = true, data = progress });
        }

        [HttpGet("progress")]
        public async Task GetProgressStream(CancellationToken cancellationToken)
        {
            Response.Headers.Append("Content-Type", "text/event-stream");
            Response.Headers.Append("Cache-Control", "no-cache");
            Response.Headers.Append("Connection", "keep-alive");

            // Write initial progress
            var initialProgress = _progressTracker.GetProgress();
            await WriteSseEventAsync(initialProgress, cancellationToken);

            // Set up update pusher callback
            var semaphore = new SemaphoreSlim(1, 1);
            Action<MigrationProgress> onProgressUpdate = async (progress) =>
            {
                try
                {
                    await semaphore.WaitAsync(cancellationToken);
                    await WriteSseEventAsync(progress, cancellationToken);
                }
                catch
                {
                    // Catch disconnected streams
                }
                finally
                {
                    semaphore.Release();
                }
            };

            _progressTracker.OnProgressUpdated += onProgressUpdate;

            try
            {
                // Hold connection open until cancelled
                while (!cancellationToken.IsCancellationRequested)
                {
                    await Task.Delay(1000, cancellationToken);
                }
            }
            catch (TaskCanceledException)
            {
                // Silent catch for stream disconnection
            }
            finally
            {
                _progressTracker.OnProgressUpdated -= onProgressUpdate;
                semaphore.Dispose();
            }
        }

        private async Task WriteSseEventAsync(MigrationProgress progress, CancellationToken cancellationToken)
        {
            var jsonStr = JsonSerializer.Serialize(progress, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            await Response.WriteAsync($"data: {jsonStr}\n\n", cancellationToken);
            await Response.Body.FlushAsync(cancellationToken);
        }
    }
}
