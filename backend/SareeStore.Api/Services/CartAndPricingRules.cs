using SareeStore.Api.DTOs;

namespace SareeStore.Api.Services;

public readonly record struct CartLineKey(int ProductId, string SizeCode);

public static class CartLineGrouping
{
    public static Dictionary<CartLineKey, int> Group(IEnumerable<CartLineRequest> lines) => lines
        .GroupBy(x => new CartLineKey(x.ProductId, (x.SizeCode ?? string.Empty).Trim().ToUpperInvariant()))
        .ToDictionary(x => x.Key, x => x.Sum(v => v.Quantity));
}

public static class DeliveryPricing
{
    public static decimal Charge(decimal payableSubtotal, decimal configuredCharge, decimal freeThreshold) =>
        payableSubtotal <= 0 || payableSubtotal >= freeThreshold ? 0 : configuredCharge;
}
