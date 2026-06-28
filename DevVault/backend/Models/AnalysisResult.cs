namespace DBMigrator.Api.Models;

public class AnalysisResult
{
    public string ProjectName { get; set; } = string.Empty;
    public List<ServiceInfo> Services { get; set; } = [];
    public List<ControllerInfo> Controllers { get; set; } = [];
    public List<GeneratedTest> Tests { get; set; } = [];
    public int TotalMethods => Services.Sum(s => s.Methods.Count) + Controllers.Sum(c => c.Methods.Count);
}
