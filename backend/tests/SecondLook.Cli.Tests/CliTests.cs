using System.IdentityModel.Tokens.Jwt;
using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using SecondLook.Cli;

namespace SecondLook.Cli.Tests;

public sealed class CliTests : IDisposable
{
    private readonly string _db = Path.Combine(Path.GetTempPath(), $"sl-cli-{Guid.NewGuid():N}.db");
    private readonly IConfiguration _config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
    {
        ["SecondLook:Jwt:Issuer"] = "cli-tests",
        ["SecondLook:Jwt:Audience"] = "cli-tests-api",
        ["SecondLook:Jwt:SigningKey"] = "cli-test-signing-key-0123456789-abcdefghijklmnop",
    }).Build();

    private string[] Args(params string[] a) => [.. a, "--provider", "Sqlite", "--connection", $"Data Source={_db}"];

    private async Task<(int code, string output)> Run(params string[] args)
    {
        var o = new StringWriter();
        var code = await CliApp.RunAsync(Args(args), _config, o, o);
        return (code, o.ToString());
    }

    private int CountUsers()
    {
        using var c = new SqliteConnection($"Data Source={_db};Pooling=False");
        c.Open();
        var cmd = c.CreateCommand();
        cmd.CommandText = "select count(*) from Users";
        return Convert.ToInt32(cmd.ExecuteScalar());
    }

    // L2-067 AC1: migrate creates the schema in isolated storage.
    [Fact]
    public async Task Migrate_creates_schema_and_is_repeatable()
    {
        (await Run("migrate")).code.Should().Be(0);
        (await Run("migrate")).code.Should().Be(0);
        CountUsers().Should().Be(0);
    }

    // L2-067 AC2: seed is idempotent and creates the four synthetic identities.
    [Fact]
    public async Task Seed_is_idempotent_and_creates_four_identities()
    {
        await Run("migrate");
        (await Run("seed")).code.Should().Be(0);
        (await Run("seed")).code.Should().Be(0);
        CountUsers().Should().Be(4);
    }

    // L2-067 AC3: seeding before migrating fails with a clear message instead of creating the schema.
    [Fact]
    public async Task Seed_without_migrate_fails_with_guidance()
    {
        var (code, output) = await Run("seed");
        code.Should().NotBe(0);
        output.Should().Contain("migrate");
    }

    // L2-067 AC4: reset empties and re-creates the database.
    [Fact]
    public async Task Reset_returns_to_an_empty_migrated_database()
    {
        await Run("migrate");
        await Run("seed");
        (await Run("reset")).code.Should().Be(0);
        CountUsers().Should().Be(0);
    }

    // L2-069: the dev token command issues a token for a seeded identity, with role and subject claims.
    [Fact]
    public async Task Token_issues_a_jwt_for_a_seeded_identity()
    {
        await Run("migrate");
        await Run("seed");
        var (code, output) = await Run("token", "--email", "mechanic@example.test");
        code.Should().Be(0);
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(output.Trim());
        jwt.Claims.Should().Contain(c => c.Type == "role" && c.Value == "Mechanic");
        jwt.Issuer.Should().Be("cli-tests");
    }

    [Fact]
    public async Task Token_for_unknown_identity_fails()
    {
        await Run("migrate");
        (await Run("token", "--email", "nobody@example.test")).code.Should().NotBe(0);
    }

    [Fact]
    public async Task Unknown_command_fails_with_usage()
    {
        var (code, output) = await Run("frobnicate");
        code.Should().NotBe(0);
        output.Should().Contain("migrate").And.Contain("seed");
    }

    public void Dispose()
    {
        SqliteConnection.ClearAllPools();
        foreach (var f in Directory.GetFiles(Path.GetTempPath(), Path.GetFileName(_db) + "*")) File.Delete(f);
    }
}
