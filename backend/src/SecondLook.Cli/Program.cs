using Microsoft.Extensions.Configuration;
using SecondLook.Cli;

var config = new ConfigurationBuilder()
    .SetBasePath(AppContext.BaseDirectory)
    .AddJsonFile("appsettings.json", optional: true)
    .AddEnvironmentVariables()
    .Build();

return await CliApp.RunAsync(args, config, Console.Out, Console.Error);
