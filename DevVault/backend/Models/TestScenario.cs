namespace DBMigrator.Api.Models;

public class TestScenario
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string InputSummary { get; set; } = string.Empty;
    public string ExpectedBehavior { get; set; } = string.Empty;
    public string MethodName { get; set; } = string.Empty;
}
