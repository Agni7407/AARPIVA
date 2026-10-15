using SareeStore.Api.DTOs;
using SareeStore.Api.Models;

namespace SareeStore.Api.Services;

public static class SizeManagementRules
{
    public static readonly string[] SupportedSizes = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

    public static bool TryValidateCategory(bool requiresSize, IEnumerable<string>? requestedSizes, SizeGuideDto? requestedGuide,
        out List<string> options, out SizeGuideDto guide, out string error)
    {
        options = (requestedSizes ?? []).Select(x => (x ?? "").Trim().ToUpperInvariant()).ToList();
        guide = requestedGuide ?? new SizeGuideDto("cm", [], new Dictionary<string, List<decimal?>>());
        error = "";
        if (!requiresSize) { options = []; return true; }
        if (options.Count == 0 || options.Any(x => !SupportedSizes.Contains(x)) || options.Distinct().Count() != options.Count)
        { error = "Choose one or more valid, unique standard sizes."; return false; }
        if (guide.Unit is not ("cm" or "in") || guide.Columns.Count is < 1 or > 8 || guide.Columns.Any(x => string.IsNullOrWhiteSpace(x) || x.Length > 32) || guide.Columns.Distinct(StringComparer.OrdinalIgnoreCase).Count() != guide.Columns.Count)
        { error = "Size guide requires 1 to 8 unique measurement labels and a valid unit."; return false; }
        foreach (var size in options)
            if (!guide.Rows.TryGetValue(size, out var row) || row.Count != guide.Columns.Count || row.Any(v => v is null or < 0 or > 10000))
            { error = $"Enter valid measurements for {size}."; return false; }
        var selected = options.ToHashSet(StringComparer.Ordinal);
        guide = guide with { Rows = guide.Rows.Where(r => selected.Contains(r.Key)).ToDictionary(r => r.Key, r => r.Value) };
        return true;
    }

    public static bool ValidateVariants(Category category, ProductRequest request)
    {
        var options = System.Text.Json.JsonSerializer.Deserialize<List<string>>(category.SizeOptionsJson) ?? [];
        var variants = request.SizeVariants ?? [];
        return category.RequiresSize
            ? variants.All(v => options.Contains(v.SizeCode) && v.Stock >= 0) && variants.Select(v => v.SizeCode).Distinct().Count() == variants.Count
            : variants.Count == 0;
    }

    public static decimal ConvertMeasurement(decimal value, string from, string to) =>
        from == to ? value : from == "in" && to == "cm" ? value * 2.54m : from == "cm" && to == "in" ? value / 2.54m : throw new ArgumentException("Unit must be 'in' or 'cm'.");

    public static bool HasStock(int available, int requested) => available >= requested && requested > 0;

    public static bool CanAcquireAll(IEnumerable<(int Available, int Requested)> lines) =>
        lines.All(line => HasStock(line.Available, line.Requested));
}

public static class OrderItemSnapshotFactory
{
    public static OrderItem Create(Product product, CartItem cartLine) => new()
    {
        ProductId = product.Id,
        ProductName = product.Name,
        UnitPrice = product.DiscountPrice ?? product.Price,
        Quantity = cartLine.Quantity,
        SizeCode = cartLine.SizeCode,
        RequiresSize = product.Category.RequiresSize
    };
}

public static class PaymentVerificationRules
{
    public static bool IsFinalized(PaymentStatus status) => status is PaymentStatus.Paid or PaymentStatus.PaidNeedsRefund;
}
