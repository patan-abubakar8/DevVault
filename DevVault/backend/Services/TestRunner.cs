using System.Diagnostics;
using DBMigrator.Api.Models;

namespace DBMigrator.Api.Services;

public class TestRunner
{
    public async Task<List<GeneratedTest>> RunTestsAsync(List<GeneratedTest> tests)
    {
        foreach (var test in tests)
        {
            await SimulateTestExecutionAsync(test);
        }

        return tests;
    }

    private async Task SimulateTestExecutionAsync(GeneratedTest test)
    {
        // For now, we simulate test execution by processing each scenario with a small delay
        foreach (var scenario in test.Scenarios)
        {
            var sw = Stopwatch.StartNew();
            await Task.Delay(Random.Shared.Next(10, 80));

            test.Status = TestStatus.Passed;
            sw.Stop();
        }
    }
}
