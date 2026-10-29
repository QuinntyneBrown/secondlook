using MediatR;
using Microsoft.EntityFrameworkCore;
using SecondLook.Application.Abstractions;
using SecondLook.Application.Scoping;
using SecondLook.Domain.Inspections;
using SecondLook.Domain.Payments;
using SecondLook.Domain.Reports;
using SecondLook.Domain.Vehicles;

namespace SecondLook.Application.Reports;

public sealed record ComparisonWindowDto(DateTimeOffset StartsAt, DateTimeOffset EndsAt, bool Open);

/// <summary>
/// One car in the comparison. <c>Status</c> is Ready (the mechanic's estimate is in, so the costs are set), Pending (the estimate is
/// not written yet) or NoEstimate (a review with the body shop alone has no certification estimate).
/// </summary>
public sealed record ComparisonColumnDto(
    Guid InspectionId, string VehicleName, string? Vin, int OdometerKm, int AskingPriceCents, string Review, string Status,
    int? CostMinCents, int? CostMaxCents, int? AllInMinCents, int? AllInMaxCents, bool Lowest);

public sealed record ComparisonDto(ComparisonWindowDto? Window, IReadOnlyList<ComparisonColumnDto> Columns, int ReadyCount);

public sealed record GetComparisonQuery : IRequest<ComparisonDto>;

/// <summary>
/// The buyer's cars from their latest pricing window, ready ones first and lowest all-in first (L2-051, L2-052, ADR 0015). The totals
/// are the ones the car's own report shows, so a column and its report never disagree.
/// </summary>
public sealed class GetComparisonHandler(IAppDbContext db, ICurrentUser caller, TimeProvider clock) : IRequestHandler<GetComparisonQuery, ComparisonDto>
{
    public async Task<ComparisonDto> Handle(GetComparisonQuery q, CancellationToken ct)
    {
        var window = (await db.PricingWindows.ForBuyer(caller).ToListAsync(ct)).OrderByDescending(w => w.StartsAt).FirstOrDefault();
        if (window is null) return new ComparisonDto(null, [], 0);

        var cars = (await db.Inspections.ForBuyer(caller).ToListAsync(ct))
            .Where(i => i.Status == InspectionStatus.Scheduled && i.CreatedAt >= window.StartsAt && i.CreatedAt < window.EndsAt)
            .OrderBy(i => i.StartUtc)
            .ToList();
        var ids = cars.Select(i => i.Id).ToList();
        var reports = await db.Reports.Where(r => ids.Contains(r.InspectionId)).ToDictionaryAsync(r => r.InspectionId, ct);
        var reportIds = reports.Values.Select(r => r.Id).ToList();
        var required = (await db.ReportFindings.Where(f => reportIds.Contains(f.ReportId) && f.Source == FindingSource.Mechanic && f.Status == FindingStatus.Required).ToListAsync(ct))
            .GroupBy(f => f.ReportId)
            .ToDictionary(g => g.Key, g => (Min: g.Sum(f => f.MinCents ?? 0), Max: g.Sum(f => f.MaxCents ?? 0)));

        var rows = cars.Select(i =>
        {
            var asking = (int)Math.Round(i.AskingPrice * 100);
            if (i.Review == ReviewType.BodyShop) return (Car: i, Asking: asking, Status: "NoEstimate", Min: (int?)null, Max: (int?)null);
            if (!reports.TryGetValue(i.Id, out var report) || report.MechanicSubmittedAt is null) return (i, asking, "Pending", null, null);
            var cost = required.GetValueOrDefault(report.Id);
            return (i, asking, "Ready", cost.Min, cost.Max);
        }).ToList();

        var ready = rows.Where(r => r.Status == "Ready")
            .OrderBy(r => r.Asking + r.Min).ThenBy(r => r.Asking + r.Max).ThenBy(r => r.Car.StartUtc).ToList();
        var others = rows.Where(r => r.Status != "Ready").OrderBy(r => r.Car.StartUtc).ToList();

        // With two or more cars to compare, every car tied with the cheapest is marked.
        (int Min, int Max)? best = null;
        if (ready.Count >= 2) best = (ready[0].Asking + ready[0].Min!.Value, ready[0].Asking + ready[0].Max!.Value);
        var columns = ready.Concat(others).Select(r =>
            new ComparisonColumnDto(
                r.Car.Id, VehicleName.Of(r.Car.Year, r.Car.Make, r.Car.Model, r.Car.Vin), r.Car.Vin, r.Car.OdometerKm, r.Asking, r.Car.Review.ToString(), r.Status, r.Min, r.Max,
                r.Status == "Ready" ? r.Asking + r.Min : null, r.Status == "Ready" ? r.Asking + r.Max : null,
                r.Status == "Ready" && best is { } b && r.Asking + r.Min == b.Min && r.Asking + r.Max == b.Max)).ToList();

        return new ComparisonDto(new ComparisonWindowDto(window.StartsAt, window.EndsAt, window.IsOpen(clock.GetUtcNow())), columns, ready.Count);
    }
}
