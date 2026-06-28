using System.IO.Compression;
using System.Text.RegularExpressions;
using PMS.TestTool.Models;

namespace PMS.TestTool.Services;

public class ProjectAnalyzer
{
    public async Task<AnalysisResult> AnalyzeAsync(
        List<IFormFile> files, string projectName, ProjectType projectType)
    {
        var tempDir = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString());
        try
        {
            Directory.CreateDirectory(tempDir);

            foreach (var file in files)
            {
                if (file.FileName.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
                {
                    using var stream = file.OpenReadStream();
                    using var archive = new ZipArchive(stream, ZipArchiveMode.Read);
                    foreach (var entry in archive.Entries)
                    {
                        if (string.IsNullOrEmpty(entry.Name)) continue;
                        var path = Path.Combine(tempDir, entry.FullName);
                        var dir = Path.GetDirectoryName(path);
                        if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                            Directory.CreateDirectory(dir);
                        entry.ExtractToFile(path, overwrite: true);
                    }
                }
                else
                {
                    var path = Path.Combine(tempDir, file.FileName);
                    using var stream = file.OpenReadStream();
                    using var fs = new FileStream(path, FileMode.Create);
                    await stream.CopyToAsync(fs);
                }
            }

            var result = new AnalysisResult { ProjectName = projectName };

            var csFiles = Directory.GetFiles(tempDir, "*.cs", SearchOption.AllDirectories);
            var jsFiles = Directory.GetFiles(tempDir, "*.js", SearchOption.AllDirectories);
            var tsFiles = Directory.GetFiles(tempDir, "*.ts", SearchOption.AllDirectories);
            var javaFiles = Directory.GetFiles(tempDir, "*.java", SearchOption.AllDirectories);

            switch (projectType)
            {
                case ProjectType.DotNet:
                    AnalyzeDotNet(csFiles, result);
                    break;
                case ProjectType.Node:
                    AnalyzeNode(jsFiles, tsFiles, result);
                    break;
                case ProjectType.Spring:
                    AnalyzeSpring(javaFiles, result);
                    break;
            }

            result.Tests = new TestGenerator().GenerateTests(result, projectType);
            return result;
        }
        finally
        {
            if (Directory.Exists(tempDir))
                Directory.Delete(tempDir, recursive: true);
        }
    }

    // ===== .NET Analyzer =====

    private static readonly Regex DNetClass = new(
        @"(?:public\s+|private\s+|protected\s+|internal\s+)?(?:static\s+|abstract\s+|partial\s+|sealed\s+)*class\s+(\w+)",
        RegexOptions.Compiled);

    private static readonly Regex DNetMethod = new(
        @"(?:public|private|protected|internal)\s+(?:static|virtual|override|abstract|async|sealed\s+)*\s*(\w+(?:<[^>]+>)?(?:\[\])?)\s+(\w+)\s*\(",
        RegexOptions.Compiled);

    private static readonly Regex DNetNamespace = new(
        @"namespace\s+([\w.]+)", RegexOptions.Compiled);

    private static readonly Regex DNetRoute = new(
        @"\[Route\s*\(\s*""([^""]+)""\s*\)\]", RegexOptions.Compiled);

    private void AnalyzeDotNet(string[] files, AnalysisResult result)
    {
        foreach (var file in files)
        {
            var content = File.ReadAllText(file);
            var nsMatch = DNetNamespace.Match(content);
            var ns = nsMatch.Success ? nsMatch.Groups[1].Value : "";

            foreach (Match cm in DNetClass.Matches(content))
            {
                var name = cm.Groups[1].Value;
                if (!name.EndsWith("Service") && !name.EndsWith("Controller"))
                    continue;

                var body = ExtractBraceBlock(content, cm.Index + cm.Length);
                var methods = ExtractDotNetMethods(body);

                if (name.EndsWith("Service"))
                {
                    result.Services.Add(new ServiceInfo
                    {
                        Name = name, Namespace = ns, FilePath = file, Methods = methods
                    });
                }
                else
                {
                    var route = DNetRoute.Match(content);
                    result.Controllers.Add(new ControllerInfo
                    {
                        Name = name, Namespace = ns, FilePath = file,
                        RoutePrefix = route.Success ? route.Groups[1].Value : $"[{name.Replace("Controller", "")}]",
                        Methods = methods
                    });
                }
            }
        }
    }

    private List<MethodInfo> ExtractDotNetMethods(string body)
    {
        var methods = new List<MethodInfo>();
        foreach (Match m in DNetMethod.Matches(body))
        {
            var name = m.Groups[2].Value;
            var retType = m.Groups[1].Value;

            if (retType == "class" || retType == "interface" || retType == "struct" ||
                retType == "record" || retType == "enum" || name == ".ctor" ||
                name == "get" || name == "set" || name.StartsWith('<'))
                continue;

            methods.Add(new MethodInfo
            {
                Name = name,
                ReturnType = retType,
                Modifiers = "public",
                IsPublic = true,
                Parameters = ParseDotNetParams(body, m.Index + m.Length)
            });
        }
        return methods;
    }

    private List<ParameterInfo> ParseDotNetParams(string body, int start)
    {
        var result = new List<ParameterInfo>();
        var depth = 1;
        var i = start;
        while (i < body.Length && depth > 0)
        {
            if (body[i] == '(') depth++;
            else if (body[i] == ')') { depth--; if (depth == 0) break; }
            i++;
        }
        var paramStr = body.Substring(start, i - start);
        if (string.IsNullOrWhiteSpace(paramStr)) return result;

        var parts = SplitParams(paramStr);
        var mods = new HashSet<string> { "params", "out", "ref", "in", "this" };

        foreach (var part in parts)
        {
            var trimmed = part.Trim();
            if (string.IsNullOrEmpty(trimmed)) continue;

            var eq = trimmed.Split('=');
            var decl = eq[0].Trim();
            var def = eq.Length > 1 ? eq[1].Trim() : null;
            var words = decl.Split(' ', StringSplitOptions.RemoveEmptyEntries);

            if (words.Length >= 2)
            {
                var types = words.Take(words.Length - 1).Where(w => !mods.Contains(w)).ToList();
                result.Add(new ParameterInfo
                {
                    Type = string.Join(" ", types),
                    Name = words[^1].TrimStart('@'),
                    HasDefaultValue = def != null,
                    DefaultValue = def
                });
            }
        }
        return result;
    }

    // ===== Node.js Analyzer =====

    private static readonly Regex NodeExportClass = new(
        @"(?:export\s+)?(?:default\s+)?class\s+(\w+)",
        RegexOptions.Compiled);

    private static readonly Regex NodeMethod = new(
        @"(?:async\s+)?(\w+)\s*[=(]\s*(?:\(([^)]*)\))?",
        RegexOptions.Compiled);

    private static readonly Regex NodeFunction = new(
        @"(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)",
        RegexOptions.Compiled);

    private static readonly Regex ArrowFunction = new(
        @"(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>",
        RegexOptions.Compiled);

    private static readonly Regex ExpressRoute = new(
        @"(?:router|app)\.(get|post|put|delete|patch)\s*\(\s*['""]([^'""]+)['""]",
        RegexOptions.Compiled);

    private void AnalyzeNode(string[] jsFiles, string[] tsFiles, AnalysisResult result)
    {
        var all = jsFiles.Concat(tsFiles).ToArray();
        foreach (var file in all)
        {
            var content = File.ReadAllText(file);
            var fileName = Path.GetFileNameWithoutExtension(file);

            if (fileName.EndsWith("Service") || fileName.EndsWith("Controller") ||
                fileName.EndsWith("service") || fileName.EndsWith("controller"))
            {
                var name = fileName;
                var methods = ExtractNodeMethods(content);
                var isController = name.EndsWith("Controller", StringComparison.OrdinalIgnoreCase) ||
                                   name.EndsWith("controller");

                if (isController)
                {
                    var routes = new List<string>();
                    foreach (Match r in ExpressRoute.Matches(content))
                        routes.Add($"{r.Groups[1].Value.ToUpper()} {r.Groups[2].Value}");

                    result.Controllers.Add(new ControllerInfo
                    {
                        Name = name, FilePath = file,
                        RoutePrefix = routes.Count > 0 ? string.Join(", ", routes) : "/api/" + name.Replace("Controller", "").ToLower(),
                        Methods = methods
                    });
                }
                else
                {
                    result.Services.Add(new ServiceInfo
                    {
                        Name = name, FilePath = file, Methods = methods
                    });
                }
            }
        }
    }

    private List<MethodInfo> ExtractNodeMethods(string content)
    {
        var methods = new List<MethodInfo>();
        var seen = new HashSet<string>();

        foreach (Match m in NodeExportClass.Matches(content))
        {
            var bodyStart = m.Index + m.Length;
            var body = ExtractBraceBlock(content, bodyStart);

            foreach (Match mm in NodeMethod.Matches(body))
            {
                var name = mm.Groups[1].Value;
                if (name == "constructor" || seen.Contains(name)) continue;
                seen.Add(name);
                methods.Add(new MethodInfo
                {
                    Name = name, IsPublic = true, ReturnType = "any",
                    Parameters = ParseGenericParams(mm.Groups[2].Value)
                });
            }
        }

        foreach (Match m in NodeFunction.Matches(content))
        {
            var name = m.Groups[1].Value;
            if (seen.Contains(name)) continue;
            seen.Add(name);
            methods.Add(new MethodInfo
            {
                Name = name, IsPublic = true, ReturnType = "any",
                Parameters = ParseGenericParams(m.Groups[2].Value)
            });
        }

        foreach (Match m in ArrowFunction.Matches(content))
        {
            var name = m.Groups[1].Value;
            if (seen.Contains(name)) continue;
            seen.Add(name);
            methods.Add(new MethodInfo
            {
                Name = name, IsPublic = true, ReturnType = "any",
                Parameters = ParseGenericParams(m.Groups[2].Value)
            });
        }

        return methods;
    }

    private List<ParameterInfo> ParseGenericParams(string paramStr)
    {
        var result = new List<ParameterInfo>();
        if (string.IsNullOrWhiteSpace(paramStr)) return result;
        foreach (var p in paramStr.Split(',', StringSplitOptions.RemoveEmptyEntries))
        {
            var trimmed = p.Trim();
            if (string.IsNullOrEmpty(trimmed)) continue;
            var parts = trimmed.Split(':');
            var name = parts[0].Trim();
            var type = parts.Length > 1 ? parts[1].Trim() : "any";
            if (name.StartsWith("...")) name = name[3..];
            result.Add(new ParameterInfo { Name = name, Type = type });
        }
        return result;
    }

    // ===== Spring Analyzer =====

    private static readonly Regex JavaClass = new(
        @"(?:public\s+|private\s+|protected\s+)?(?:abstract\s+)?class\s+(\w+)",
        RegexOptions.Compiled);

    private static readonly Regex JavaMethod = new(
        @"(?:public|private|protected)\s+(?:static\s+)?(?:final\s+)?(\w+(?:<[^>]+>)?(?:\[\])?)\s+(\w+)\s*\(",
        RegexOptions.Compiled);

    private static readonly Regex JavaAnnotation = new(
        @"@(\w+)",
        RegexOptions.Compiled);

    private static readonly Regex RequestMapping = new(
        @"@(GetMapping|PostMapping|PutMapping|DeleteMapping|RequestMapping)\s*\(\s*(?:value\s*=\s*)?""([^""]*)""",
        RegexOptions.Compiled);

    private void AnalyzeSpring(string[] files, AnalysisResult result)
    {
        foreach (var file in files)
        {
            var content = File.ReadAllText(file);
            var pkg = "";
            var pkgMatch = Regex.Match(content, @"package\s+([\w.]+);");
            if (pkgMatch.Success) pkg = pkgMatch.Groups[1].Value;

            var annotations = new List<string>();
            foreach (Match a in JavaAnnotation.Matches(content))
                annotations.Add(a.Groups[1].Value);

            var isService = annotations.Any(a => a.Contains("Service"));
            var isController = annotations.Any(a =>
                a.Contains("Controller") || a.Contains("RestController"));

            foreach (Match cm in JavaClass.Matches(content))
            {
                var name = cm.Groups[1].Value;

                if (isService || name.EndsWith("Service"))
                {
                    var body = ExtractBraceBlock(content, cm.Index + cm.Length);
                    result.Services.Add(new ServiceInfo
                    {
                        Name = name, Namespace = pkg, FilePath = file,
                        Methods = ExtractJavaMethods(body)
                    });
                }

                if (isController || name.EndsWith("Controller"))
                {
                    var body = ExtractBraceBlock(content, cm.Index + cm.Length);
                    var methods = ExtractJavaMethods(body);

                    // Annotate with route info
                    foreach (var method in methods)
                    {
                        foreach (Match rm in RequestMapping.Matches(content))
                        {
                            var httpMethod = rm.Groups[1].Value switch
                            {
                                "GetMapping" => "GET",
                                "PostMapping" => "POST",
                                "PutMapping" => "PUT",
                                "DeleteMapping" => "DELETE",
                                _ => "ANY"
                            };
                            method.Modifiers = httpMethod;
                        }
                    }

                    result.Controllers.Add(new ControllerInfo
                    {
                        Name = name, Namespace = pkg, FilePath = file,
                        RoutePrefix = "/api/" + name.Replace("Controller", "").ToLower(),
                        Methods = methods
                    });
                }
            }
        }
    }

    private List<MethodInfo> ExtractJavaMethods(string body)
    {
        var methods = new List<MethodInfo>();
        foreach (Match m in JavaMethod.Matches(body))
        {
            var name = m.Groups[2].Value;
            var retType = m.Groups[1].Value;
            if (retType == "class" || retType == "interface" || retType == "enum" ||
                name == ".ctor" || name == "get" || name == "set" || name.StartsWith('<'))
                continue;

            methods.Add(new MethodInfo
            {
                Name = name, ReturnType = retType,
                IsPublic = true, Modifiers = "public",
                Parameters = ParseDotNetParams(body, m.Index + m.Length)
            });
        }
        return methods;
    }

    // ===== Shared Helpers =====

    private string ExtractBraceBlock(string text, int startIndex)
    {
        var depth = 0;
        var found = false;
        var start = startIndex;
        for (int i = startIndex; i < text.Length; i++)
        {
            if (text[i] == '{')
            {
                if (!found) { found = true; start = i + 1; }
                depth++;
            }
            else if (text[i] == '}')
            {
                depth--;
                if (found && depth == 0)
                    return text[start..i];
            }
        }
        return found ? text[start..] : "";
    }

    private List<string> SplitParams(string s)
    {
        var parts = new List<string>();
        var depth = 0;
        var cur = new System.Text.StringBuilder();
        foreach (var c in s)
        {
            if (c == ',' && depth == 0) { parts.Add(cur.ToString()); cur.Clear(); }
            else { if ("<([{".Contains(c)) depth++; if (">)]}".Contains(c)) depth--; cur.Append(c); }
        }
        if (cur.Length > 0) parts.Add(cur.ToString());
        return parts;
    }
}
