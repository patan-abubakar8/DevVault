using System.Text;
using DBMigrator.Api.Models;

namespace DBMigrator.Api.Services;

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
        sb.AppendLine("{");

        foreach (var method in methods.Where(m => m.IsPublic))
        {
            var methodScenarios = GenerateScenarios(method);
            scenarios.AddRange(methodScenarios);

            foreach (var scenario in methodScenarios)
            {
                sb.AppendLine("    [Fact]");
                sb.AppendLine($"    public void {method.Name}_{scenario.Name}()");
                sb.AppendLine("    {");
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
                sb.AppendLine("    }");
                sb.AppendLine();
            }
        }

        sb.AppendLine("}");

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
        var name = method.Name.ToLower();

        // 1. Dynamic name-based scenarios
        if (name.StartsWith("get") || name.StartsWith("find") || name.StartsWith("search") || name.StartsWith("retrieve"))
        {
            scenarios.Add(new TestScenario
            {
                Name = "Should_ReturnData_When_RecordExists",
                Description = $"Tests that {method.Name} fetches and returns the record successfully if it exists.",
                Category = "Happy Path",
                InputSummary = BuildInputsString(method.Parameters),
                ExpectedBehavior = $"Should return the requested record ({method.ReturnType})"
            });

            scenarios.Add(new TestScenario
            {
                Name = "Should_ReturnNullOrEmpty_When_RecordNotFound",
                Description = $"Tests that {method.Name} returns null or empty collection when matching record does not exist.",
                Category = "Edge Case",
                InputSummary = BuildInputsString(method.Parameters), // fallback or query values
                ExpectedBehavior = "Should return null or empty state gracefully"
            });
        }
        else if (name.StartsWith("save") || name.StartsWith("create") || name.StartsWith("add") || name.StartsWith("insert") || name.StartsWith("update"))
        {
            scenarios.Add(new TestScenario
            {
                Name = "Should_PersistData_When_PayloadIsValid",
                Description = $"Tests that {method.Name} successfully validates and commits a correct data model.",
                Category = "Happy Path",
                InputSummary = BuildInputsString(method.Parameters),
                ExpectedBehavior = "Should write to database, publish events and return confirmation"
            });

            scenarios.Add(new TestScenario
            {
                Name = "Should_ThrowValidationException_When_PayloadIsInvalid",
                Description = $"Tests that {method.Name} fails validation checks on bad/incomplete input.",
                Category = "Validation",
                InputSummary = BuildInputsString(method.Parameters, null, "Validation Fail"),
                ExpectedBehavior = "Should block execution and throw validation error"
            });
        }
        else if (name.StartsWith("delete") || name.StartsWith("remove") || name.StartsWith("clear"))
        {
            scenarios.Add(new TestScenario
            {
                Name = "Should_RemoveSuccessfully_When_RecordExists",
                Description = $"Tests that {method.Name} locates the target entry and removes it.",
                Category = "Happy Path",
                InputSummary = BuildInputsString(method.Parameters),
                ExpectedBehavior = "Should delete record and release resources"
            });

            scenarios.Add(new TestScenario
            {
                Name = "Should_IgnoreOrReturnNotFound_When_RecordDoesNotExist",
                Description = $"Tests {method.Name} handles missing record deletion requests gracefully.",
                Category = "Edge Case",
                InputSummary = BuildInputsString(method.Parameters),
                ExpectedBehavior = "Should not throw unexpected exceptions; returns false or no-op"
            });
        }
        else if (name.StartsWith("validate") || name.StartsWith("check") || name.StartsWith("verify") || name.StartsWith("is") || name.StartsWith("can") || name.StartsWith("has"))
        {
            scenarios.Add(new TestScenario
            {
                Name = "Should_ReturnTrue_When_ConditionIsSatisfied",
                Description = $"Tests that {method.Name} returns true when condition parameters are correct.",
                Category = "Happy Path",
                InputSummary = BuildInputsString(method.Parameters),
                ExpectedBehavior = "Should validate successfully and return true"
            });

            scenarios.Add(new TestScenario
            {
                Name = "Should_ReturnFalse_When_ConditionIsNotSatisfied",
                Description = $"Tests that {method.Name} flags failing checks.",
                Category = "Validation",
                InputSummary = BuildInputsString(method.Parameters),
                ExpectedBehavior = "Should reject and return false"
            });
        }
        else if (name.StartsWith("calculate") || name.StartsWith("compute") || name.StartsWith("process") || name.StartsWith("convert") || name.StartsWith("parse"))
        {
            scenarios.Add(new TestScenario
            {
                Name = "Should_ReturnCorrectCalculation_When_ParamsAreStandard",
                Description = $"Tests that {method.Name} processes variables correctly under typical workloads.",
                Category = "Happy Path",
                InputSummary = BuildInputsString(method.Parameters),
                ExpectedBehavior = $"Should execute calculation formulas and return expected {method.ReturnType}"
            });

            scenarios.Add(new TestScenario
            {
                Name = "Should_HandleLimitValues_WithoutOverflow",
                Description = $"Tests {method.Name} handles boundary conditions or limits correctly.",
                Category = "Boundary",
                InputSummary = BuildInputsString(method.Parameters, null, "Boundary Limit"),
                ExpectedBehavior = "Should compute safely within boundary bounds"
            });
        }
        else
        {
            // Default generic fallback
            scenarios.Add(new TestScenario
            {
                Name = "Should_ReturnExpected_When_ValidInput",
                Description = $"Tests {method.Name} with valid input parameters.",
                Category = "Happy Path",
                InputSummary = BuildInputsString(method.Parameters),
                ExpectedBehavior = $"Should execute successfully and return expected {method.ReturnType}"
            });
        }

        // 2. Specific Parameter Type validations
        foreach (var param in method.Parameters)
        {
            if (param.Type.StartsWith("string") || param.Type.StartsWith("IEnumerable") ||
                param.Type.StartsWith("List") || param.Type.StartsWith("Array") ||
                param.Type.StartsWith("object") || param.Type.StartsWith("Task") ||
                param.Type == "String" || param.Type == "Object")
            {
                scenarios.Add(new TestScenario
                {
                    Name = $"Should_ThrowArgumentNullException_When_{param.Name}IsNull",
                    Description = $"Tests that {method.Name} protects against null reference crashes for parameter '{param.Name}'.",
                    Category = "Null Check",
                    InputSummary = BuildInputsString(method.Parameters, param.Name, "Null Check"),
                    ExpectedBehavior = $"Should throw ArgumentNullException for '{param.Name}'"
                });
            }
        }

        foreach (var param in method.Parameters)
        {
            if (param.Type == "string" || param.Type == "String")
            {
                scenarios.Add(new TestScenario
                {
                    Name = $"Should_ThrowArgumentException_When_{param.Name}IsEmpty",
                    Description = $"Tests that {method.Name} throws or fails when empty string is passed for '{param.Name}'.",
                    Category = "Edge Case",
                    InputSummary = BuildInputsString(method.Parameters, param.Name, "Edge Case Empty"),
                    ExpectedBehavior = $"Should reject empty string input for '{param.Name}'"
                });
                scenarios.Add(new TestScenario
                {
                    Name = $"Should_ThrowArgumentException_When_{param.Name}IsWhitespace",
                    Description = $"Tests that {method.Name} throws or fails when whitespace string is passed for '{param.Name}'.",
                    Category = "Edge Case",
                    InputSummary = BuildInputsString(method.Parameters, param.Name, "Edge Case Whitespace"),
                    ExpectedBehavior = $"Should reject whitespace-only input for '{param.Name}'"
                });
                break;
            }
        }

        foreach (var param in method.Parameters.Where(p => p.Type == "int" || p.Type == "long" || p.Type == "Integer" || p.Type == "Long"))
        {
            scenarios.Add(new TestScenario
            {
                Name = $"Should_HandleZero{param.Name}",
                Description = $"Tests {method.Name} handles boundary zero input for parameter '{param.Name}'.",
                Category = "Boundary",
                InputSummary = BuildInputsString(method.Parameters, param.Name, "Boundary Zero"),
                ExpectedBehavior = "Should process zero value safely or raise out of range exception"
            });
            scenarios.Add(new TestScenario
            {
                Name = $"Should_ThrowArgumentOutOfRangeException_When_{param.Name}IsNegative",
                Description = $"Tests that {method.Name} rejects negative integer parameter '{param.Name}'.",
                Category = "Boundary",
                InputSummary = BuildInputsString(method.Parameters, param.Name, "Boundary Negative"),
                ExpectedBehavior = $"Should fail or throw ArgumentOutOfRangeException for negative '{param.Name}'"
            });
            break;
        }

        foreach (var param in method.Parameters.Where(p => p.Type == "bool" || p.Type == "Boolean"))
        {
            scenarios.Add(new TestScenario
            {
                Name = $"Should_Handle{param.Name}IsFalse",
                Description = $"Tests behavior when boolean flag '{param.Name}' is false.",
                Category = "Boolean State",
                InputSummary = BuildInputsString(method.Parameters, param.Name, "Boolean State False"),
                ExpectedBehavior = "Should execute logical branch associated with false flag"
            });
            break;
        }

        scenarios.Add(new TestScenario
        {
            Name = "Should_ThrowException_When_DependencyFails",
            Description = $"Tests {method.Name} error handling and translation when underlying data or network dependency fails.",
            Category = "Error Path",
            InputSummary = BuildInputsString(method.Parameters), // typical inputs with dependency mock failure
            ExpectedBehavior = "Should handle exception or wrap and throw domain specific exception"
        });

        foreach (var s in scenarios)
        {
            s.MethodName = method.Name;
        }

        return scenarios;
    }

    private string GetConcreteTestValue(ParameterInfo param, string scenarioCategory)
    {
        var type = param.Type.Trim();
        var cleanType = type.Replace("?", "").Replace("Nullable<", "").Replace(">", "").Trim();

        if (scenarioCategory == "Null Check")
        {
            return "null";
        }

        if (cleanType == "string" || cleanType == "String")
        {
            if (scenarioCategory == "Edge Case Empty")
                return "\"\"";
            if (scenarioCategory == "Edge Case Whitespace")
                return "\"   \"";
            return $"\"test_{param.Name}\"";
        }

        if (cleanType == "int" || cleanType == "long" || cleanType == "short" || cleanType == "byte" ||
            cleanType == "Integer" || cleanType == "Long" || cleanType == "int?" || cleanType == "long?")
        {
            if (scenarioCategory == "Boundary Zero")
                return "0";
            if (scenarioCategory == "Boundary Negative")
                return "-1";
            return "42";
        }

        if (cleanType == "double" || cleanType == "float" || cleanType == "decimal" || cleanType == "Double" || cleanType == "Float" || cleanType == "Decimal")
        {
            if (scenarioCategory == "Boundary Zero")
                return "0.0";
            if (scenarioCategory == "Boundary Negative")
                return "-1.0";
            return "99.9";
        }

        if (cleanType == "bool" || cleanType == "Boolean")
        {
            if (scenarioCategory == "Boolean State False")
                return "false";
            return "true";
        }

        if (cleanType == "DateTime" || cleanType == "Date" || cleanType == "Instant")
        {
            return "DateTime.UtcNow";
        }

        if (cleanType == "Guid")
        {
            return "Guid.NewGuid()";
        }

        if (cleanType.Contains("List") || cleanType.Contains("IEnumerable") || cleanType.Contains("[]") || cleanType.Contains("Collection"))
        {
            return "[]";
        }

        if (scenarioCategory == "Validation Fail")
        {
            return $"new {cleanType} {{ /* Invalid/Incomplete payload */ }}";
        }

        return $"new {cleanType}()";
    }

    private string BuildInputsString(List<ParameterInfo> parameters, string targetParamName = null, string targetCategory = null)
    {
        if (parameters == null || parameters.Count == 0)
        {
            return "void (No Parameters)";
        }

        var parts = new List<string>();
        foreach (var p in parameters)
        {
            string val;
            if (p.Name == targetParamName && targetCategory != null)
            {
                val = GetConcreteTestValue(p, targetCategory);
            }
            else
            {
                val = GetConcreteTestValue(p, targetCategory == "Boundary Limit" ? "Boundary Zero" : "Happy Path");
            }
            parts.Add($"{p.Name}: {val}");
        }

        return string.Join(", ", parts);
    }
}
