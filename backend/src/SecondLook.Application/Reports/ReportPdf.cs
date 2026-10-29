using System.Globalization;
using System.Text;

namespace SecondLook.Application.Reports;

/// <summary>
/// Renders a report as a plain, text-only PDF (L2-048). The format is small enough to write directly: a catalogue, the pages,
/// one standard font and a text stream per page, so no PDF library or licence is needed (ADR 0013).
/// </summary>
internal static class ReportPdf
{
    private const int LinesPerPage = 46;
    private const int Wrap = 88;

    public static byte[] Render(ReportDto r)
    {
        var lines = new List<string>
        {
            "SecondLook - Your report",
            "",
            $"Vehicle {r.Vin} - {r.OdometerKm.ToString("N0", CultureInfo.InvariantCulture)} km - asking {Money(r.AskingPriceCents)}",
            $"Written by {r.MechanicName}" + (r.CallEndedAt is { } ended ? $" after the call on {ended:ddd d MMM yyyy}" : ""),
            "",
            $"Estimated cost to get it safety certified: {Range(r.CostMinCents, r.CostMaxCents)}",
            $"{r.RequiredCount} required repair{(r.RequiredCount == 1 ? "" : "s")}. All-in with the asking price: {Range(r.AllInMinCents, r.AllInMaxCents)}",
            "",
            "Findings",
        };
        foreach (var f in r.Findings)
        {
            lines.AddRange(WrapText($"[{f.Status}] {f.Title} - {(f.MinCents is { } lo && f.MaxCents is { } hi ? Range(lo, hi) : "no cost")}"));
            if (f.Note.Length > 0) lines.AddRange(WrapText("    " + f.Note));
        }
        lines.Add("");
        lines.Add("Body shop review: " + r.BodyShop.Status switch
        {
            "InProgress" => "in progress",
            "NotShared" => "not included",
            "Ready" => "ready",
            _ => "not requested",
        });
        lines.Add("");
        lines.AddRange(WrapText(r.Disclaimer));

        var pages = lines.Chunk(LinesPerPage).ToList();
        var objects = new List<string>
        {
            "<< /Type /Catalog /Pages 2 0 R >>",
            "<< /Type /Pages /Kids [" + string.Join(" ", pages.Select((_, n) => $"{4 + n * 2} 0 R")) + $"] /Count {pages.Count} >>",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
        };
        foreach (var page in pages)
        {
            var content = new StringBuilder("BT /F1 11 Tf 14 TL 56 790 Td\n");
            foreach (var line in page) content.Append('(').Append(Escape(line)).Append(") Tj T*\n");
            content.Append("ET");
            var pageNumber = objects.Count + 1;
            objects.Add($"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents {pageNumber + 1} 0 R >>");
            objects.Add($"<< /Length {content.Length} >>\nstream\n{content}\nendstream");
        }

        var output = new StringBuilder("%PDF-1.4\n");
        var offsets = new List<int>();
        for (var n = 0; n < objects.Count; n++)
        {
            offsets.Add(output.Length);
            output.Append($"{n + 1} 0 obj\n{objects[n]}\nendobj\n");
        }
        var xref = output.Length;
        output.Append($"xref\n0 {objects.Count + 1}\n0000000000 65535 f \n");
        foreach (var offset in offsets) output.Append($"{offset:D10} 00000 n \n");
        output.Append($"trailer\n<< /Size {objects.Count + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n");
        return Encoding.Latin1.GetBytes(output.ToString());
    }

    private static string Money(int cents) => "$" + (cents / 100m).ToString("N0", CultureInfo.InvariantCulture);

    private static string Range(int min, int max) => min == max ? Money(min) : $"{Money(min)} to {Money(max)}";

    /// <summary>Folds typographic characters to ones the standard font has, and escapes what a PDF string reserves.</summary>
    private static string Escape(string text)
    {
        var folded = text.Replace('’', '\'').Replace('‘', '\'').Replace('“', '"').Replace('”', '"').Replace('–', '-').Replace('—', '-').Replace('·', '-');
        var sb = new StringBuilder();
        foreach (var ch in folded)
        {
            if (ch is '(' or ')' or '\\') sb.Append('\\').Append(ch);
            else sb.Append(ch < 128 ? ch : '?');
        }
        return sb.ToString();
    }

    private static IEnumerable<string> WrapText(string text)
    {
        var line = new StringBuilder();
        foreach (var word in text.Split(' '))
        {
            if (line.Length + word.Length + 1 > Wrap && line.Length > 0)
            {
                yield return line.ToString();
                line.Clear().Append("    ");
            }
            if (line.Length > 0 && line[^1] != ' ') line.Append(' ');
            line.Append(word);
        }
        if (line.Length > 0) yield return line.ToString();
    }
}
