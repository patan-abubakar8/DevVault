namespace PMS.TestTool.Models;

public class ControllerInfo
{
    public string Name { get; set; } = string.Empty;
    public string Namespace { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public string RoutePrefix { get; set; } = string.Empty;
    public List<MethodInfo> Methods { get; set; } = [];
}
