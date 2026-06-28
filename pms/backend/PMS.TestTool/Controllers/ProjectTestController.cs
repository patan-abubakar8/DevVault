using Microsoft.AspNetCore.Mvc;
using PMS.TestTool.Models;
using PMS.TestTool.Services;

namespace PMS.TestTool.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProjectTestController : ControllerBase
{
    private readonly ProjectAnalyzer _analyzer;
    private readonly TestRunner _runner;
    private static readonly Dictionary<string, AnalysisResult> _sessions = new();

    public ProjectTestController()
    {
        _analyzer = new ProjectAnalyzer();
        _runner = new TestRunner();
    }

    [HttpPost("analyze")]
    [RequestSizeLimit(500_000_000)]
    public async Task<IActionResult> Analyze(
        [FromForm] List<IFormFile> files,
        [FromForm] string projectType = "DotNet")
    {
        if (files == null || files.Count == 0)
            return BadRequest(new { error = "No files uploaded" });

        if (!Enum.TryParse<ProjectType>(projectType, ignoreCase: true, out var pt))
            return BadRequest(new { error = $"Invalid project type: {projectType}. Use DotNet, Node, or Spring" });

        var sessionId = Guid.NewGuid().ToString();
        var result = await _analyzer.AnalyzeAsync(files, files[0].FileName, pt);

        _sessions[sessionId] = result;

        return Ok(new
        {
            sessionId,
            projectType = pt.ToString(),
            projectName = result.ProjectName,
            services = result.Services.Select(s => new
            {
                name = s.Name,
                @namespace = s.Namespace,
                methods = s.Methods.Select(m => new
                {
                    name = m.Name,
                    returnType = m.ReturnType,
                    parameters = m.Parameters.Select(p => new { name = p.Name, type = p.Type }),
                    isPublic = m.IsPublic
                })
            }),
            controllers = result.Controllers.Select(c => new
            {
                name = c.Name,
                @namespace = c.Namespace,
                routePrefix = c.RoutePrefix,
                methods = c.Methods.Select(m => new
                {
                    name = m.Name,
                    returnType = m.ReturnType,
                    parameters = m.Parameters.Select(p => new { name = p.Name, type = p.Type }),
                    isPublic = m.IsPublic
                })
            }),
            totalMethods = result.TotalMethods,
            testsGenerated = result.Tests.Count,
            tests = result.Tests.Select(t => new
            {
                className = t.ClassName,
                targetClass = t.TargetClass,
                testType = t.TestType,
                status = t.Status.ToString(),
                errorMessage = t.ErrorMessage,
                testCode = t.TestCode,
                scenarios = t.Scenarios.Select(s => new
                {
                    name = s.Name,
                    description = s.Description,
                    category = s.Category,
                    inputSummary = s.InputSummary,
                    expectedBehavior = s.ExpectedBehavior
                })
            })
        });
    }

    [HttpGet("tests/{sessionId}")]
    public IActionResult GetTests(string sessionId)
    {
        if (!_sessions.TryGetValue(sessionId, out var result))
            return NotFound(new { error = "Session not found" });

        return Ok(new
        {
            projectName = result.ProjectName,
            tests = result.Tests.Select(t => new
            {
                className = t.ClassName,
                targetClass = t.TargetClass,
                testType = t.TestType,
                status = t.Status.ToString(),
                errorMessage = t.ErrorMessage,
                scenarios = t.Scenarios.Select(s => new
                {
                    name = s.Name,
                    description = s.Description,
                    category = s.Category,
                    inputSummary = s.InputSummary,
                    expectedBehavior = s.ExpectedBehavior
                }),
                testCode = t.TestCode
            })
        });
    }

    [HttpPost("run/{sessionId}")]
    public async Task<IActionResult> RunTests(string sessionId)
    {
        if (!_sessions.TryGetValue(sessionId, out var result))
            return NotFound(new { error = "Session not found" });

        var results = await _runner.RunTestsAsync(result.Tests);

        return Ok(new
        {
            sessionId,
            summary = new
            {
                total = results.Count,
                passed = results.Count(r => r.Status == TestStatus.Passed),
                failed = results.Count(r => r.Status == TestStatus.Failed),
                pending = results.Count(r => r.Status == TestStatus.Pending)
            },
            details = results.Select(t => new
            {
                className = t.ClassName,
                status = t.Status.ToString(),
                errorMessage = t.ErrorMessage,
                scenarioCount = t.Scenarios.Count
            })
        });
    }
}
