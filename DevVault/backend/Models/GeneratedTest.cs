namespace DBMigrator.Api.Models;

public class GeneratedTest
{
    public string ClassName { get; set; } = string.Empty;
    public string TargetClass { get; set; } = string.Empty;
    public string TestType { get; set; } = string.Empty;
    public string TestCode { get; set; } = string.Empty;
    public List<TestScenario> Scenarios { get; set; } = [];
    public TestStatus Status { get; set; }
    public string? ErrorMessage { get; set; }
}
