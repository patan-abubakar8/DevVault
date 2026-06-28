namespace DBMigrator.Api.Models;

public class MethodInfo
{
    public string Name { get; set; } = string.Empty;
    public string ReturnType { get; set; } = string.Empty;
    public List<ParameterInfo> Parameters { get; set; } = [];
    public string Modifiers { get; set; } = string.Empty;
    public bool IsPublic { get; set; }
    public string Body { get; set; } = string.Empty;
}
