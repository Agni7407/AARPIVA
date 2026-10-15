using SareeStore.Api.DTOs;
using SareeStore.Api.Models;
using SareeStore.Api.Services;
using Xunit;

namespace SareeStore.Api.Tests;

public class SizeInventoryAndR2RulesTests
{
    private static SizeGuideDto Guide(List<string>? columns = null, List<decimal?>? row = null) =>
        new("in", columns ?? ["Chest", "Length"], new Dictionary<string, List<decimal?>> { ["M"] = row ?? [42m, 27.5m] });

    [Fact]
    public void NonSizedCategoryDoesNotRequireGuideOrOptions()
    {
        Assert.True(SizeManagementRules.TryValidateCategory(false, null, null, out var sizes, out _, out _));
        Assert.Empty(sizes);
    }

    [Fact]
    public void CategoryAcceptsSupportedSubsetAndDecimalMeasurements()
    {
        Assert.True(SizeManagementRules.TryValidateCategory(true, [" m ", "XL"], new SizeGuideDto("cm", ["Chest"], new Dictionary<string, List<decimal?>> { ["M"] = [42.25m], ["XL"] = [48m] }), out var sizes, out var guide, out _));
        Assert.Equal(["M", "XL"], sizes);
        Assert.Equal(42.25m, guide.Rows["M"][0]);
    }

    [Theory]
    [InlineData("4XL")]
    [InlineData("M ")]
    public void UnsupportedOrDuplicateSizesAreRejected(string malformed)
    {
        Assert.False(SizeManagementRules.TryValidateCategory(true, [malformed, "M"], Guide(), out _, out _, out _));
    }

    [Fact]
    public void MissingAndNullMeasurementsAreRejected()
    {
        var missing = new SizeGuideDto("in", ["Chest"], new Dictionary<string, List<decimal?>>());
        var nullValue = new SizeGuideDto("in", ["Chest"], new Dictionary<string, List<decimal?>> { ["M"] = [null] });
        Assert.False(SizeManagementRules.TryValidateCategory(true, ["M"], missing, out _, out _, out _));
        Assert.False(SizeManagementRules.TryValidateCategory(true, ["M"], nullValue, out _, out _, out _));
    }

    [Theory]
    [InlineData(42.5, "in", "cm", 107.95)]
    [InlineData(107.95, "cm", "in", 42.5)]
    public void MeasurementConversionUsesExactDecimalRatio(decimal value, string from, string to, decimal expected) =>
        Assert.Equal(expected, SizeManagementRules.ConvertMeasurement(value, from, to));

    [Fact]
    public void ProductVariantsMustBeUniqueConfiguredAndNonNegative()
    {
        var category = new Category { RequiresSize = true, SizeOptionsJson = "[\"M\",\"L\"]" };
        ProductRequest Request(List<ProductVariantRequest> variants) => new("Kurti", 1, "", 100, null, 0, true, null, variants);
        Assert.True(SizeManagementRules.ValidateVariants(category, Request([new("M", 0), new("L", 3)])));
        Assert.False(SizeManagementRules.ValidateVariants(category, Request([new("M", 1), new("M", 2)])));
        Assert.False(SizeManagementRules.ValidateVariants(category, Request([new("XL", 1)])));
        Assert.False(SizeManagementRules.ValidateVariants(category, Request([new("M", -1)])));
    }

    [Fact]
    public void NonSizedProductsRejectVariantInventoryButRetainProductStock()
    {
        var category = new Category { RequiresSize = false };
        Assert.True(SizeManagementRules.ValidateVariants(category, new ProductRequest("Saree", 1, "", 100, null, 8)));
        Assert.False(SizeManagementRules.ValidateVariants(category, new ProductRequest("Saree", 1, "", 100, null, 8, true, null, [new("M", 1)])));
    }

    [Fact]
    public void CartLinesMergeOnlyWhenProductAndNormalizedSizeMatch()
    {
        var grouped = CartLineGrouping.Group([new(3, 1, "m"), new(3, 2, "M"), new(3, 4, "L"), new(4, 5)]);
        Assert.Equal(3, grouped[new(3, "M")]);
        Assert.Equal(4, grouped[new(3, "L")]);
        Assert.Equal(5, grouped[new(4, "")]);
        Assert.Equal(3, grouped.Count);
    }

    [Theory]
    [InlineData(1498.99, 99, 1499, 99)]
    [InlineData(1499, 99, 1499, 0)]
    [InlineData(0, 99, 1499, 0)]
    public void DeliveryPricingPreservesThreshold(decimal subtotal, decimal configured, decimal threshold, decimal expected) =>
        Assert.Equal(expected, DeliveryPricing.Charge(subtotal, configured, threshold));

    [Theory]
    [InlineData(1, 1, true)]
    [InlineData(0, 1, false)]
    [InlineData(3, 4, false)]
    public void StockCheckRejectsZeroOrInsufficientUnits(int available, int requested, bool expected) =>
        Assert.Equal(expected, SizeManagementRules.HasStock(available, requested));

    [Fact]
    public void LatePaymentAcquiresNothingUnlessEveryProductSizeIsAvailable()
    {
        Assert.False(SizeManagementRules.CanAcquireAll(new[] { (Available: 4, Requested: 1), (Available: 0, Requested: 1) }));
        Assert.True(SizeManagementRules.CanAcquireAll(new[] { (Available: 4, Requested: 1), (Available: 2, Requested: 2) }));
    }

    [Fact]
    public void OrderItemSnapshotPreservesSelectedSizeAndSizingMode()
    {
        var product = new Product { Id = 19, Name = "Cotton Kurti", Price = 1200m, DiscountPrice = 999m, Category = new Category { RequiresSize = true } };
        var cartLine = new CartItem { ProductId = 19, Quantity = 2, SizeCode = "XL" };
        var snapshot = OrderItemSnapshotFactory.Create(product, cartLine);
        Assert.Equal("XL", snapshot.SizeCode);
        Assert.True(snapshot.RequiresSize);
        Assert.Equal(999m, snapshot.UnitPrice);
        Assert.Equal(2, snapshot.Quantity);
    }

    [Fact]
    public void FinalizedPaymentStatesAreIdempotent()
    {
        Assert.True(PaymentVerificationRules.IsFinalized(PaymentStatus.Paid));
        Assert.True(PaymentVerificationRules.IsFinalized(PaymentStatus.PaidNeedsRefund));
        Assert.False(PaymentVerificationRules.IsFinalized(PaymentStatus.Pending));
        Assert.False(PaymentVerificationRules.IsFinalized(PaymentStatus.Failed));
    }

    [Fact]
    public void OwnedR2UrlRoundTripsTheCurrentPublicUrlFormat()
    {
        const string baseUrl = "https://images.aarpiva.com/assets";
        const string bucket = "aarpiva-products";
        const string key = "products/2026/10/0123456789abcdef0123456789abcdef";
        var url = R2ObjectKeyMapper.BuildPublicUrl(baseUrl, bucket, key);
        Assert.Equal("https://images.aarpiva.com/assets/aarpiva-products/products/2026/10/0123456789abcdef0123456789abcdef", url);
        Assert.True(R2ObjectKeyMapper.TryGetOwnedObjectKey(url, baseUrl, bucket, out var parsed));
        Assert.Equal(key, parsed);
    }

    [Theory]
    [InlineData("https://attacker.example/aarpiva-products/products/2026/10/0123456789abcdef0123456789abcdef")]
    [InlineData("https://images.aarpiva.com:444/aarpiva-products/products/2026/10/0123456789abcdef0123456789abcdef")]
    [InlineData("https://images.aarpiva.com/aarpiva-products/products/../private")]
    [InlineData("https://images.aarpiva.com/aarpiva-products/products/2026/13/0123456789abcdef0123456789abcdef")]
    [InlineData("/assets/products/2026/10/0123456789abcdef0123456789abcdef")]
    public void ExternalRepositoryAndMalformedR2UrlsAreRejected(string url) =>
        Assert.False(R2ObjectKeyMapper.TryGetOwnedObjectKey(url, "https://images.aarpiva.com", "aarpiva-products", out _));

    [Fact]
    public void ReferencePolicyKeepsObjectsUsedByHiddenProductsOrCustomCategories()
    {
        const string baseUrl = "https://images.aarpiva.com";
        const string bucket = "aarpiva-products";
        const string key = "products/2026/10/0123456789abcdef0123456789abcdef";
        var sharedUrl = R2ObjectKeyMapper.BuildPublicUrl(baseUrl, bucket, key);
        bool Maps(string url) => R2ObjectKeyMapper.TryGetOwnedObjectKey(url, baseUrl, bucket, out var parsed) && parsed == key;
        Assert.True(ImageReferencePolicy.IsReferenced(key, new string?[] { sharedUrl, "https://other.example/image.png" }, Maps));
        Assert.False(ImageReferencePolicy.IsReferenced(key, new string?[] { "/assets/products/x.jpg", "https://other.example/image.png" }, Maps));
    }

    [Fact]
    public void DeletingOneProductReferenceRetainsAnImageStillUsedByCategory()
    {
        const string baseUrl = "https://images.aarpiva.com";
        const string bucket = "aarpiva-products";
        const string key = "products/2026/10/0123456789abcdef0123456789abcdef";
        var productImage = R2ObjectKeyMapper.BuildPublicUrl(baseUrl, bucket, key);
        var customCategoryImage = productImage;
        bool Maps(string url) => R2ObjectKeyMapper.TryGetOwnedObjectKey(url, baseUrl, bucket, out var parsed) && parsed == key;
        Assert.True(ImageReferencePolicy.IsReferenced(key, new string?[] { customCategoryImage }, Maps));
        Assert.False(ImageReferencePolicy.IsReferenced(key, new string?[] { "/assets/local.jpg" }, Maps));
    }
}
