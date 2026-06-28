using System.Text;
using PMS.TestTool.Models;

namespace PMS.TestTool.Services;

public class TestGenerator
{
    public List<GeneratedTest> GenerateTests(AnalysisResult result, ProjectType projectType)
    {
        var tests = new List<GeneratedTest>();

        foreach (var service in result.Services)
        {
            tests.Add(projectType switch
            {
                ProjectType.Node => GenerateNodeTest(service.Name, service.Namespace, service.Methods, "Service"),
                ProjectType.Spring => GenerateJavaTest(service.Name, service.Namespace, service.Methods, "Service"),
                _ => GenerateDotNetTest(service.Name, service.Namespace, service.Methods, "Service"),
            });
        }

        foreach (var controller in result.Controllers)
        {
            tests.Add(projectType switch
            {
                ProjectType.Node => GenerateNodeTest(controller.Name, controller.Namespace, controller.Methods, "Controller"),
                ProjectType.Spring => GenerateJavaTest(controller.Name, controller.Namespace, controller.Methods, "Controller"),
                _ => GenerateDotNetTest(controller.Name, controller.Namespace, controller.Methods, "Controller"),
            });
        }

        return tests;
    }

    private GeneratedTest GenerateDotNetTest(string className, string ns, List<MethodInfo> methods, string type)
    {
        var scenarios = new List<TestScenario>();
        var sb = new StringBuilder();

        sb.AppendLine("using Xunit;");
        sb.AppendLine("using Moq;");
        sb.AppendLine("using FluentAssertions;");
        if (!string.IsNullOrEmpty(ns)) sb.AppendLine($"using {ns};");
        sb.AppendLine();
        sb.AppendLine($"namespace {ns}.Tests;");
        sb.AppendLine();
        sb.AppendLine($"public class {className}Tests");
        sb.AppendLine("{{");

        foreach (var method in methods.Where(m => m.IsPublic))
        {
            var methodScenarios = GenerateScenarios(method);
            scenarios.AddRange(methodScenarios);

            foreach (var scenario in methodScenarios)
            {
                sb.AppendLine("    [Fact]");
                sb.AppendLine($"    public void {method.Name}_{scenario.Name}()");
                sb.AppendLine("    {{");
                sb.AppendLine($"        // {scenario.Description}");
                sb.AppendLine("        // Arrange");
                foreach (var p in method.Parameters)
                    sb.AppendLine($"        var {p.Name} = default({p.Type}); // TODO: setup");
                sb.AppendLine();
                sb.AppendLine("        // Act");
                sb.AppendLine($"        // var result = target.{method.Name}({string.Join(", ", method.Parameters.Select(p => p.Name))});");
                sb.AppendLine();
                sb.AppendLine("        // Assert");
                sb.AppendLine($"        // {scenario.ExpectedBehavior}");
                sb.AppendLine("    }}");
                sb.AppendLine();
            }
        }

        sb.AppendLine("}}");

        return new GeneratedTest
        {
            ClassName = $"{className}Tests",
            TargetClass = className,
            TestType = type,
            TestCode = sb.ToString(),
            Scenarios = scenarios,
            Status = TestStatus.Pending
        };
    }

    private GeneratedTest GenerateNodeTest(string className, string ns, List<MethodInfo> methods, string type)
    {
        var scenarios = new List<TestScenario>();
        var sb = new StringBuilder();

        sb.AppendLine($"const {{ {className} }} = require('../{className}');");
        sb.AppendLine();
        sb.AppendLine($"describe('{className}', () => {{");

        foreach (var method in methods)
        {
            var methodScenarios = GenerateScenarios(method);
            scenarios.AddRange(methodScenarios);

            foreach (var scenario in methodScenarios)
            {
                sb.AppendLine($"  describe('{method.Name}', () => {{");
                sb.AppendLine($"    it('{scenario.Name}', () => {{");
                sb.AppendLine($"      // {scenario.Description}");
                sb.AppendLine("      // Arrange");
                foreach (var p in method.Parameters)
                    sb.AppendLine($"      const {p.Name} = null; // TODO: setup");
                sb.AppendLine();
                sb.AppendLine("      // Act");
                sb.AppendLine($"      // const result = {className}.{method.Name}({string.Join(", ", method.Parameters.Select(p => p.Name))});");
                sb.AppendLine();
                sb.AppendLine("      // Assert");
                sb.AppendLine($"      // {scenario.ExpectedBehavior}");
                sb.AppendLine("    });");
                sb.AppendLine("  });");
            }
        }

        sb.AppendLine("});");

        return new GeneratedTest
        {
            ClassName = $"{className}Test",
            TargetClass = className,
            TestType = type,
            TestCode = sb.ToString(),
            Scenarios = scenarios,
            Status = TestStatus.Pending
        };
    }

    private GeneratedTest GenerateJavaTest(string className, string ns, List<MethodInfo> methods, string type)
    {
        var scenarios = new List<TestScenario>();
        var sb = new StringBuilder();

        sb.AppendLine("import org.junit.jupiter.api.Test;");
        sb.AppendLine("import org.junit.jupiter.api.extension.ExtendWith;");
        sb.AppendLine("import org.mockito.InjectMocks;");
        sb.AppendLine("import org.mockito.Mock;");
        sb.AppendLine("import org.mockito.junit.jupiter.MockitoExtension;");
        sb.AppendLine($"import {ns}.{className};");
        sb.AppendLine();
        sb.AppendLine("@ExtendWith(MockitoExtension.class)");
        sb.AppendLine($"public class {className}Test {{");
        sb.AppendLine();
        sb.AppendLine($"    @InjectMocks");
        sb.AppendLine($"    private {className} {className.ToLower()[0]}{className.Substring(1)};");
        sb.AppendLine();

        foreach (var method in methods)
        {
            var methodScenarios = GenerateScenarios(method);
            scenarios.AddRange(methodScenarios);

            foreach (var scenario in methodScenarios)
            {
                sb.AppendLine("    @Test");
                sb.AppendLine($"    public void {method.Name}_{scenario.Name}() {{");
                sb.AppendLine($"        // {scenario.Description}");
                sb.AppendLine("        // Arrange");
                foreach (var p in method.Parameters)
                    sb.AppendLine($"        {p.Type} {p.Name} = null; // TODO: setup");
                sb.AppendLine();
                sb.AppendLine("        // Act");
                sb.AppendLine($"        // var result = {className.ToLower()[0]}{className.Substring(1)}.{method.Name}({string.Join(", ", method.Parameters.Select(p => p.Name))});");
                sb.AppendLine();
                sb.AppendLine("        // Assert");
                sb.AppendLine($"        // {scenario.ExpectedBehavior}");
                sb.AppendLine("    }");
                sb.AppendLine();
            }
        }

        sb.AppendLine("}");

        return new GeneratedTest
        {
            ClassName = $"{className}Test",
            TargetClass = className,
            TestType = type,
            TestCode = sb.ToString(),
            Scenarios = scenarios,
            Status = TestStatus.Pending
        };
    }

    public List<TestScenario> GenerateScenarios(MethodInfo method)
    {
        var scenarios = new List<TestScenario>();

        scenarios.Add(new TestScenario
        {
            Name = "Should_ReturnExpected_When_ValidInput",
            Description = $"Tests {method.Name} with valid input parameters",
            Category = "Happy Path",
            InputSummary = $"Valid {string.Join(", ", method.Parameters.Select(p => p.Name))}",
            ExpectedBehavior = $"Should execute successfully and return expected {method.ReturnType}"
        });

        foreach (var param in method.Parameters)
        {
            if (param.Type.StartsWith("string") || param.Type.StartsWith("IEnumerable") ||
                param.Type.StartsWith("List") || param.Type.StartsWith("Array") ||
                param.Type.StartsWith("object") || param.Type.StartsWith("Task") ||
                param.Type == "String" || param.Type == "Object")
            {
                scenarios.Add(new TestScenario
                {
                    Name = $"Should_ThrowException_When_{param.Name}IsNull",
                    Description = $"Tests {method.Name} throws when {param.Name} is null",
                    Category = "Null Check",
                    InputSummary = $"{param.Name} = null",
                    ExpectedBehavior = $"Should throw exception for null '{param.Name}'"
                });
            }
        }

        foreach (var param in method.Parameters)
        {
            if (param.Type == "string" || param.Type == "String")
            {
                scenarios.Add(new TestScenario
                {
                    Name = $"Should_HandleEmpty{param.Name}_Gracefully",
                    Description = $"Tests {method.Name} with empty {param.Name} string",
                    Category = "Edge Case",
                    InputSummary = $"{param.Name} = empty string",
                    ExpectedBehavior = "Should handle empty string gracefully"
                });
                scenarios.Add(new TestScenario
                {
                    Name = $"Should_HandleWhitespace{param.Name}",
                    Description = $"Tests {method.Name} with whitespace {param.Name}",
                    Category = "Edge Case",
                    InputSummary = $"{param.Name} = whitespace",
                    ExpectedBehavior = "Should handle whitespace string gracefully"
                });
                break;
            }
        }

        foreach (var param in method.Parameters.Where(p => p.Type == "int" || p.Type == "long" || p.Type == "Integer" || p.Type == "Long"))
        {
            scenarios.Add(new TestScenario
            {
                Name = $"Should_HandleZero{param.Name}",
                Description = $"Tests {method.Name} with {param.Name} = 0",
                Category = "Boundary",
                InputSummary = $"{param.Name} = 0",
                ExpectedBehavior = "Should handle zero value gracefully"
            });
            scenarios.Add(new TestScenario
            {
                Name = $"Should_HandleNegative{param.Name}",
                Description = $"Tests {method.Name} with negative {param.Name}",
                Category = "Boundary",
                InputSummary = $"{param.Name} = -1",
                ExpectedBehavior = "Should handle negative value (or throw)"
            });
            break;
        }

        foreach (var param in method.Parameters.Where(p => p.Type == "bool" || p.Type == "Boolean"))
        {
            scenarios.Add(new TestScenario
            {
                Name = $"Should_Handle{param.Name}IsFalse",
                Description = $"Tests behavior when {param.Name} is false",
                Category = "Boolean State",
                InputSummary = $"{param.Name} = false",
                ExpectedBehavior = "Should handle false flag correctly"
            });
            break;
        }

        scenarios.Add(new TestScenario
        {
            Name = "Should_ThrowException_When_InvalidState",
            Description = $"Tests {method.Name} throws appropriate exception under invalid state",
            Category = "Error Path",
            InputSummary = "Invalid internal state or dependencies",
            ExpectedBehavior = "Should throw appropriate exception"
        });

        return scenarios;
    }
}
