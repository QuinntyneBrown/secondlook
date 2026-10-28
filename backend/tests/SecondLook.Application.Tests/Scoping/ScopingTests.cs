using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using SecondLook.Application.Scoping;
using SecondLook.Domain.Users;

namespace SecondLook.Application.Tests.Scoping;

public class ScopingTests
{
    private sealed class Item : IBuyerOwned, IProviderAssigned
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid BuyerId { get; set; }
        public Guid? MechanicId { get; set; }
        public Guid? BodyShopId { get; set; }
    }

    private sealed class Db(DbContextOptions<Db> o) : DbContext(o)
    {
        public DbSet<Item> Items => Set<Item>();
    }

    private static Db NewDb() => new(new DbContextOptionsBuilder<Db>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static readonly Guid BuyerA = Guid.NewGuid(), BuyerB = Guid.NewGuid(), MechA = Guid.NewGuid(), MechB = Guid.NewGuid(), ShopA = Guid.NewGuid();

    private static async Task<Db> Seeded()
    {
        var db = NewDb();
        db.Items.AddRange(
            new Item { BuyerId = BuyerA, MechanicId = MechA, BodyShopId = ShopA },
            new Item { BuyerId = BuyerB, MechanicId = MechB });
        await db.SaveChangesAsync();
        return db;
    }

    // L2-057: a buyer sees only their own resources, and another buyer's resource is simply absent.
    [Fact]
    public async Task Buyer_scope_returns_only_the_callers_items()
    {
        await using var db = await Seeded();
        var items = await db.Items.ForCaller(new CurrentUser(BuyerA, UserRole.Buyer)).ToListAsync();
        items.Should().HaveCount(1).And.OnlyContain(i => i.BuyerId == BuyerA);
    }

    // L2-058: providers see only what is assigned to them.
    [Fact]
    public async Task Provider_scope_returns_only_assigned_items()
    {
        await using var db = await Seeded();
        (await db.Items.ForCaller(new CurrentUser(MechA, UserRole.Mechanic)).ToListAsync()).Should().ContainSingle(i => i.MechanicId == MechA);
        (await db.Items.ForCaller(new CurrentUser(ShopA, UserRole.BodyShop)).ToListAsync()).Should().ContainSingle(i => i.BodyShopId == ShopA);
        (await db.Items.ForCaller(new CurrentUser(Guid.NewGuid(), UserRole.Mechanic)).ToListAsync()).Should().BeEmpty();
    }

    // L2-070 AC3: the caller identity is a role plus an id the handler never takes from the client.
    [Fact]
    public async Task Admin_scope_sees_everything()
    {
        await using var db = await Seeded();
        (await db.Items.ForCaller(new CurrentUser(Guid.NewGuid(), UserRole.Admin)).ToListAsync()).Should().HaveCount(2);
    }
}
