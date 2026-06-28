using Microsoft.AspNetCore.Mvc;
using DBMigrator.Api.Models;
using DBMigrator.Api.Services;

namespace DBMigrator.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ConnectionController : ControllerBase
    {
        private readonly ISqlServerMetadataReader _metadataReader;
        private readonly IPostgresWriter _postgresWriter;

        public ConnectionController(ISqlServerMetadataReader metadataReader, IPostgresWriter postgresWriter)
        {
            _metadataReader = metadataReader;
            _postgresWriter = postgresWriter;
        }

        [HttpPost("test-sqlserver")]
        public IActionResult TestSqlServer([FromBody] ConnectionRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.ConnectionString))
            {
                return BadRequest(new { success = false, message = "Connection string is required" });
            }

            bool isConnected = _metadataReader.TestConnection(request.ConnectionString, out string error);
            if (isConnected)
            {
                return Ok(new { success = true, message = "SQL Server connection successful" });
            }

            return BadRequest(new { success = false, message = "SQL Server connection failed", error });
        }

        [HttpPost("test-postgres")]
        public IActionResult TestPostgres([FromBody] ConnectionRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.ConnectionString))
            {
                return BadRequest(new { success = false, message = "Connection string is required" });
            }

            bool isConnected = _postgresWriter.TestConnection(request.ConnectionString, out string error);
            if (isConnected)
            {
                return Ok(new { success = true, message = "PostgreSQL connection successful" });
            }

            return BadRequest(new { success = false, message = "PostgreSQL connection failed", error });
        }
    }
}
