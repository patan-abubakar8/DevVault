namespace PMS.TestTool.Models;

public class AnalysisResult
{
    public string ProjectName { get; set; } = string.Empty;
    public List<ServiceInfo> Services { get; set; } = [];
    public List<ControllerInfo> Controllers { get; set; } = [];
    public List<GeneratedTest> Tests { get; set; } = [];
    public int TotalMethods => Services.Sum(s => s.Methods.Count) + Controllers.Sum(c => c.Methods.Count);
}

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
