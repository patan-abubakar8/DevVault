namespace PMS.TestTool.Models;

public class TestResult
{
    public string MethodName { get; set; } = string.Empty;
    public string ScenarioName { get; set; } = string.Empty;
    public TestStatus Status { get; set; }
    public string? ErrorMessage { get; set; }
    public long DurationMs { get; set; }
}

public enum TestStatus
{
    Pending,
    Passed,
    Failed,
    Skipped
}
