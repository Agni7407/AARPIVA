using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SareeStore.Api.Data;
using SareeStore.Api.DTOs;
using SareeStore.Api.Models;
using System.Text.Json;
using SareeStore.Api.Services;

namespace SareeStore.Api.Controllers;

[ApiController, Route("api/products")]
public class ProductsController(AppDbContext db, IR2StorageService storage, ILogger<ProductsController> logger) : ControllerBase
{
    private IQueryable<Product> Query(bool includeInactive = false) =>
        db.Products
            .Include(x => x.Category)
            .Include(x => x.Images)
            .Include(x => x.SizeVariants)
            .Where(x => includeInactive || x.IsActive);

    [HttpGet]
    public async Task<ActionResult> Get(
        [FromQuery] int? categoryId,
        [FromQuery] string? search,
        [FromQuery] decimal? minPrice,
        [FromQuery] decimal? maxPrice)
    {
        var q = Query();
        if (categoryId.HasValue) q = q.Where(x => x.CategoryId == categoryId.Value);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var normalized = search.Trim().ToLower();
            q = q.Where(x => x.Name.ToLower().Contains(normalized));
        }
        if (minPrice.HasValue) q = q.Where(x => (x.DiscountPrice ?? x.Price) >= minPrice.Value);
        if (maxPrice.HasValue) q = q.Where(x => (x.DiscountPrice ?? x.Price) <= maxPrice.Value);

        return Ok((await q.OrderByDescending(x => x.CreatedAt).ToListAsync()).Select(ToResponse).ToList());
    }

    [Authorize(Policy = "Admin"), HttpGet("admin")]
    public async Task<ActionResult> GetAdmin() => Ok((await Query(includeInactive: true).OrderByDescending(x => x.CreatedAt).ToListAsync()).Select(ToResponse).ToList());

    [HttpGet("{id:int}")]
    public async Task<ActionResult> GetOne(int id)
    {
        var p = await Query().Include(x => x.SizeVariants).FirstOrDefaultAsync(x => x.Id == id);
        return p is null ? NotFound() : Ok(ToResponse(p));
    }

    [Authorize(Policy = "Admin"), HttpPost]
    public async Task<ActionResult> Create(ProductRequest req)
    {
        await using var imageLock = await ImageReferenceCoordinator.AcquireAsync(db, HttpContext.RequestAborted);
        if (!await db.Categories.AnyAsync(x => x.Id == req.CategoryId && x.IsActive))
            return BadRequest("Invalid or inactive category.");

        if (req.DiscountPrice.HasValue && req.DiscountPrice.Value > req.Price)
            return BadRequest("Discount price cannot be greater than the regular price.");
        var category = await db.Categories.FirstAsync(x => x.Id == req.CategoryId);
        if (!SizeManagementRules.ValidateVariants(category, req)) return BadRequest("Product sizes must be unique sizes configured for the category, with non-negative stock.");

        var name = req.Name.Trim();
        if (string.IsNullOrWhiteSpace(name)) return BadRequest("Product name is required.");
        var slug = await UniqueSlugAsync(name);

        var p = new Product
        {
            CategoryId = req.CategoryId,
            Name = name,
            Slug = slug,
            Description = req.Description?.Trim() ?? "",
            Price = req.Price,
            DiscountPrice = req.DiscountPrice,
            Stock = req.Stock,
            IsActive = req.IsActive,
            Images = BuildImages(req.ImageUrls)
        };
        p.SizeVariants = BuildVariants(req.SizeVariants);

        db.Products.Add(p);
        await db.SaveChangesAsync();
        await db.Entry(p).Reference(x => x.Category).LoadAsync();
        await db.Entry(p).Collection(x => x.SizeVariants).LoadAsync();
        return Ok(ToResponse(p));
    }

    [Authorize(Policy = "Admin"), HttpPut("{id:int}")]
    public async Task<ActionResult> Update(int id, ProductRequest req)
    {
        await using var imageLock = await ImageReferenceCoordinator.AcquireAsync(db, HttpContext.RequestAborted);
        await using var inventoryTransaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.ReadCommitted);
        var p = await db.Products.Include(x => x.Images).Include(x => x.Category).Include(x => x.SizeVariants).FirstOrDefaultAsync(x => x.Id == id);
        if (p is null) return NotFound();
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT \"Id\" FROM \"Products\" WHERE \"Id\" = {id} FOR UPDATE");
        await db.Entry(p).ReloadAsync();
        db.Entry(p).Collection(x => x.Images).IsLoaded = false;
        db.Entry(p).Collection(x => x.SizeVariants).IsLoaded = false;
        db.Entry(p).Reference(x => x.Category).IsLoaded = false;
        await db.Entry(p).Collection(x => x.Images).LoadAsync();
        await db.Entry(p).Collection(x => x.SizeVariants).LoadAsync();
        await db.Entry(p).Reference(x => x.Category).LoadAsync();
        if (!await db.Categories.AnyAsync(x => x.Id == req.CategoryId)) return BadRequest("Invalid category.");
        if (req.DiscountPrice.HasValue && req.DiscountPrice.Value > req.Price) return BadRequest("Discount price cannot be greater than the regular price.");
        var category = await db.Categories.FirstAsync(x => x.Id == req.CategoryId);
        if (!SizeManagementRules.ValidateVariants(category, req)) return BadRequest("Product sizes must be unique sizes configured for the category, with non-negative stock.");

        var name = req.Name.Trim();
        if (string.IsNullOrWhiteSpace(name)) return BadRequest("Product name is required.");

        var removedImageUrls = p.Images.Select(i => i.ImageUrl).Except((req.ImageUrls ?? []).Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()), StringComparer.OrdinalIgnoreCase).ToList();
        p.CategoryId = req.CategoryId;
        p.Name = name;
        p.Slug = await UniqueSlugAsync(name, p.Id);
        p.Description = req.Description?.Trim() ?? "";
        p.Price = req.Price;
        p.DiscountPrice = req.DiscountPrice;
        p.Stock = req.Stock;
        p.IsActive = req.IsActive;
        ReconcileVariants(p, req.SizeVariants);
        db.ProductImages.RemoveRange(p.Images);
        p.Images = BuildImages(req.ImageUrls);

        await db.SaveChangesAsync();
        await inventoryTransaction.CommitAsync();
        await db.Entry(p).Reference(x => x.Category).LoadAsync();
        await CleanupUnreferencedImagesAsync(removedImageUrls);
        return Ok(ToResponse(p));
    }

    private async Task CleanupUnreferencedImagesAsync(IEnumerable<string> urls)
    {
        foreach (var url in urls)
        {
            if (!storage.TryGetOwnedObjectKey(url, out var key)) continue;
            var productUrls = await db.ProductImages.Select(x => x.ImageUrl).ToListAsync();
            var categoryUrls = await db.Categories.Where(x => x.ImageUrl != null).Select(x => x.ImageUrl!).ToListAsync();
            if (ImageReferencePolicy.IsReferenced(key, productUrls.Concat(categoryUrls), reference => storage.TryGetOwnedObjectKey(reference, out var referencedKey) && referencedKey == key)) continue;
            try { await storage.DeleteObjectAsync(key); }
            catch (Exception ex) { logger.LogError(ex, "Database unlinked image {ObjectKey}, but R2 cleanup failed.", key); }
        }
    }

    [Authorize(Policy = "Admin"), HttpDelete("{id:int}")]
    public async Task<ActionResult> Delete(int id)
    {
        var p = await db.Products.FindAsync(id);
        if (p is null) return NotFound();
        p.IsActive = false;
        await db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<string> UniqueSlugAsync(string name, int? currentId = null)
    {
        var baseSlug = ApiHelper.Slug(name);
        if (string.IsNullOrWhiteSpace(baseSlug)) baseSlug = $"product-{Guid.NewGuid():N}"[..19];
        var slug = baseSlug;
        var suffix = 2;
        while (await db.Products.AnyAsync(x => x.Slug == slug && (!currentId.HasValue || x.Id != currentId.Value)))
        {
            slug = $"{baseSlug}-{suffix++}";
        }
        return slug;
    }

    private static List<ProductImage> BuildImages(IEnumerable<string>? urls) =>
        (urls ?? Enumerable.Empty<string>())
            .Select(u => (u ?? "").Trim())
            .Where(u => !string.IsNullOrWhiteSpace(u))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(10)
            .Select((u, i) => new ProductImage { ImageUrl = u, IsPrimary = i == 0 })
            .ToList();

    private static List<ProductSizeVariant> BuildVariants(IEnumerable<ProductVariantRequest>? variants) => (variants ?? []).Select(v => new ProductSizeVariant { SizeCode = v.SizeCode, Stock = v.Stock, IsEnabled = v.IsEnabled }).ToList();
    private static void ReconcileVariants(Product product, IEnumerable<ProductVariantRequest>? requested)
    {
        var inputs = (requested ?? []).ToDictionary(v => v.SizeCode, StringComparer.Ordinal);
        foreach (var variant in product.SizeVariants)
        {
            if (inputs.Remove(variant.SizeCode, out var input))
            {
                variant.Stock = input.Stock;
                variant.IsEnabled = input.IsEnabled;
            }
            else variant.IsEnabled = false; // Keep historical variant stock for pending order snapshots.
        }
        foreach (var input in inputs.Values)
            product.SizeVariants.Add(new ProductSizeVariant { ProductId = product.Id, SizeCode = input.SizeCode, Stock = input.Stock, IsEnabled = input.IsEnabled });
    }
    private static ProductResponse ToResponse(Product p)
    {
        var options = JsonSerializer.Deserialize<List<string>>(p.Category.SizeOptionsJson) ?? [];
        return new ProductResponse(p.Id, p.CategoryId, p.Category.Name, p.Name, p.Slug, p.Description, p.Price, p.DiscountPrice, p.Stock, p.IsActive,
            p.Images.OrderByDescending(i => i.IsPrimary).Select(i => i.ImageUrl).ToList(), p.Category.RequiresSize, options,
            p.SizeVariants.Select(v => new ProductVariantResponse(v.SizeCode, v.Stock, v.IsEnabled, v.Stock > 0 && v.IsEnabled)).ToList(), p.Category.SizeGuideJson);
    }
}
