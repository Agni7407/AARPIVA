using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SareeStore.Api.Data;
using SareeStore.Api.DTOs;
using System.Text.Json;
using SareeStore.Api.Services;

namespace SareeStore.Api.Controllers;

[ApiController, Route("api/categories")]
public class CategoriesController(AppDbContext db, IR2StorageService storage, ILogger<CategoriesController> logger) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult> Get(CancellationToken cancellationToken)
    {
        var categories = await db.Categories.AsNoTracking()
        .Where(x => x.IsActive)
        .OrderBy(x => x.Name)
        .Select(x => new CategoryImageRow(x.Id, x.Name, x.Slug, x.IsActive, x.ImageMode, x.ImageUrl, x.RequiresSize, x.SizeOptionsJson, x.SizeGuideJson))
        .ToListAsync(cancellationToken);

        var productImages = await FirstProductImagesAsync(categories, cancellationToken);
        return Ok(categories.Select(category => new CategoryResponse(
            category.Id,
            category.Name,
            category.Slug,
            category.IsActive,
            ResolvedImage(category, productImages), category.RequiresSize, ParseSizes(category.SizeOptionsJson), ParseGuide(category.SizeGuideJson))).ToList());
    }

    [Authorize(Policy = "Admin"), HttpGet("admin")]
    public async Task<ActionResult> GetAdmin(CancellationToken cancellationToken)
    {
        var categories = await db.Categories.AsNoTracking()
        .OrderBy(x => x.Name)
        .Select(x => new CategoryImageRow(x.Id, x.Name, x.Slug, x.IsActive, x.ImageMode, x.ImageUrl, x.RequiresSize, x.SizeOptionsJson, x.SizeGuideJson))
        .ToListAsync(cancellationToken);

        var productImages = await FirstProductImagesAsync(categories, cancellationToken, includeCustomCategories: true);
        return Ok(categories.Select(category => ToAdminResponse(category, productImages)).ToList());
    }

    [Authorize(Policy = "Admin"), HttpPost]
    public async Task<ActionResult> Create(CategoryRequest req, CancellationToken cancellationToken)
    {
        await using var imageLock = await ImageReferenceCoordinator.AcquireAsync(db, cancellationToken);
        var name = req.Name.Trim();
        if (string.IsNullOrWhiteSpace(name)) return BadRequest("Category name is required.");
        if (!TryNormalizeImageSettings(req, out var imageMode, out var imageUrl, out var imageError))
            return BadRequest(imageError);
        if (!SizeManagementRules.TryValidateCategory(req.RequiresSize, req.SizeOptions, req.SizeGuide, out var sizeOptions, out var sizeGuide, out var sizeError)) return BadRequest(sizeError);
        var slug = ApiHelper.Slug(name);
        if (await db.Categories.AnyAsync(x => x.Slug == slug, cancellationToken)) return Conflict("Category already exists.");
        var c = new Models.Category { Name = name, Slug = slug, IsActive = req.IsActive, ImageMode = imageMode, ImageUrl = imageUrl, RequiresSize = req.RequiresSize, SizeOptionsJson = JsonSerializer.Serialize(sizeOptions, JsonSerializerOptions.Web), SizeGuideJson = JsonSerializer.Serialize(sizeGuide, JsonSerializerOptions.Web) };
        db.Categories.Add(c);
        await db.SaveChangesAsync(cancellationToken);
        return Ok(await ToAdminResponseAsync(c, cancellationToken));
    }

    [Authorize(Policy = "Admin"), HttpPut("{id:int}")]
    public async Task<ActionResult> Update(int id, CategoryRequest req, CancellationToken cancellationToken)
    {
        await using var imageLock = await ImageReferenceCoordinator.AcquireAsync(db, cancellationToken);
        await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.ReadCommitted, cancellationToken);
        var c = await db.Categories.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (c is null) return NotFound();
        var productIds = await db.Products.Where(x => x.CategoryId == id).Select(x => x.Id).OrderBy(x => x).ToListAsync(cancellationToken);
        foreach (var productId in productIds)
            await db.Database.ExecuteSqlInterpolatedAsync($"SELECT \"Id\" FROM \"Products\" WHERE \"Id\" = {productId} FOR UPDATE", cancellationToken);
        await db.Entry(c).ReloadAsync(cancellationToken);
        var name = req.Name.Trim();
        if (string.IsNullOrWhiteSpace(name)) return BadRequest("Category name is required.");
        if (!TryNormalizeImageSettings(req, out var imageMode, out var imageUrl, out var imageError))
            return BadRequest(imageError);
        if (!SizeManagementRules.TryValidateCategory(req.RequiresSize, req.SizeOptions, req.SizeGuide, out var sizeOptions, out var sizeGuide, out var sizeError)) return BadRequest(sizeError);
        var slug = ApiHelper.Slug(name);
        if (await db.Categories.AnyAsync(x => x.Id != id && x.Slug == slug, cancellationToken)) return Conflict("Category already exists.");
        c.Name = name;
        c.Slug = slug;
        c.IsActive = req.IsActive;
        c.ImageMode = imageMode;
        var oldImageUrl = c.ImageUrl;
        c.ImageUrl = imageUrl;
        c.RequiresSize = req.RequiresSize;
        c.SizeOptionsJson = JsonSerializer.Serialize(sizeOptions, JsonSerializerOptions.Web);
        c.SizeGuideJson = JsonSerializer.Serialize(sizeGuide, JsonSerializerOptions.Web);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        if (oldImageUrl is not null && oldImageUrl != imageUrl && storage.TryGetOwnedObjectKey(oldImageUrl, out var oldKey))
        {
            var productUrls = await db.ProductImages.Select(x => x.ImageUrl).ToListAsync(cancellationToken);
            var categoryUrls = await db.Categories.Where(x => x.ImageUrl != null).Select(x => x.ImageUrl!).ToListAsync(cancellationToken);
            if (!ImageReferencePolicy.IsReferenced(oldKey, productUrls.Concat(categoryUrls), reference => storage.TryGetOwnedObjectKey(reference, out var referencedKey) && referencedKey == oldKey))
                try { await storage.DeleteObjectAsync(oldKey, cancellationToken); }
                catch (Exception ex) { logger.LogError(ex, "Database unlinked category image {ObjectKey}, but R2 cleanup failed.", oldKey); }
        }
        return Ok(await ToAdminResponseAsync(c, cancellationToken));
    }

    [Authorize(Policy = "Admin"), HttpDelete("{id:int}")]
    public async Task<ActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        await using var imageLock = await ImageReferenceCoordinator.AcquireAsync(db, cancellationToken);
        var c = await db.Categories.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (c is null) return NotFound();
        var oldImageUrl = c.ImageUrl;
        var has = await db.Products.AnyAsync(p => p.CategoryId == id, cancellationToken);
        if (has)
        {
            c.IsActive = false;
            await db.SaveChangesAsync(cancellationToken);
            return Ok(new { message = "Category deactivated because it has products." });
        }
        db.Categories.Remove(c);
        await db.SaveChangesAsync(cancellationToken);
        if (oldImageUrl is not null) await CleanupImageIfUnreferencedAsync(oldImageUrl, cancellationToken);
        return NoContent();
    }

    private async Task CleanupImageIfUnreferencedAsync(string url, CancellationToken cancellationToken)
    {
        if (!storage.TryGetOwnedObjectKey(url, out var key)) return;
        var productUrls = await db.ProductImages.Select(x => x.ImageUrl).ToListAsync(cancellationToken);
        var categoryUrls = await db.Categories.Where(x => x.ImageUrl != null).Select(x => x.ImageUrl!).ToListAsync(cancellationToken);
        if (ImageReferencePolicy.IsReferenced(key, productUrls.Concat(categoryUrls), reference => storage.TryGetOwnedObjectKey(reference, out var referencedKey) && referencedKey == key)) return;
        try { await storage.DeleteObjectAsync(key, cancellationToken); }
        catch (Exception ex) { logger.LogError(ex, "Database unlinked category image {ObjectKey}, but R2 cleanup failed.", key); }
    }

    private async Task<Dictionary<int, string>> FirstProductImagesAsync(
        IReadOnlyCollection<CategoryImageRow> categories,
        CancellationToken cancellationToken,
        bool includeCustomCategories = false)
    {
        var categoryIds = categories
            .Where(category => includeCustomCategories || category.ImageMode != "custom" || !IsValidCustomImageUrl(category.ImageUrl))
            .Select(category => category.Id)
            .ToArray();
        if (categoryIds.Length == 0) return [];

        var candidates = await db.ProductImages.AsNoTracking()
            .Where(image => categoryIds.Contains(image.Product.CategoryId) && image.Product.IsActive)
            .OrderBy(image => image.Product.CreatedAt)
            .ThenBy(image => image.Product.Id)
            .ThenByDescending(image => image.IsPrimary)
            .ThenBy(image => image.Id)
            .Select(image => new ProductImageCandidate(image.Product.CategoryId, image.ImageUrl))
            .ToListAsync(cancellationToken);

        return candidates
            .Where(image => IsSupportedProductImageUrl(image.ImageUrl))
            .GroupBy(image => image.CategoryId)
            .ToDictionary(group => group.Key, group => group.First().ImageUrl);
    }

    private async Task<AdminCategoryResponse> ToAdminResponseAsync(Models.Category category, CancellationToken cancellationToken)
    {
        var row = new CategoryImageRow(category.Id, category.Name, category.Slug, category.IsActive, category.ImageMode, category.ImageUrl, category.RequiresSize, category.SizeOptionsJson, category.SizeGuideJson);
        var productImages = await FirstProductImagesAsync([row], cancellationToken, includeCustomCategories: true);
        return ToAdminResponse(row, productImages);
    }

    private static AdminCategoryResponse ToAdminResponse(CategoryImageRow category, IReadOnlyDictionary<int, string> productImages)
    {
        var isCustom = category.ImageMode == "custom" && IsValidCustomImageUrl(category.ImageUrl);
        var resolvedImageUrl = isCustom
            ? category.ImageUrl
            : productImages.GetValueOrDefault(category.Id);

        return new AdminCategoryResponse(
            category.Id,
            category.Name,
            category.Slug,
            category.IsActive,
            isCustom ? "custom" : "auto",
            isCustom ? category.ImageUrl : null,
            resolvedImageUrl, category.RequiresSize, ParseSizes(category.SizeOptionsJson), ParseGuide(category.SizeGuideJson));
    }

    private static string? ResolvedImage(CategoryImageRow category, IReadOnlyDictionary<int, string> productImages) =>
        category.ImageMode == "custom" && IsValidCustomImageUrl(category.ImageUrl)
            ? category.ImageUrl
            : productImages.GetValueOrDefault(category.Id);

    private static bool TryNormalizeImageSettings(
        CategoryRequest request,
        out string imageMode,
        out string? imageUrl,
        out string? error)
    {
        imageMode = request.ImageMode?.Trim().ToLowerInvariant() ?? "auto";
        imageUrl = null;
        error = null;

        if (imageMode is not ("auto" or "custom"))
        {
            error = "Image mode must be 'auto' or 'custom'.";
            return false;
        }

        if (imageMode == "auto") return true;

        imageUrl = request.ImageUrl?.Trim();
        if (!IsValidCustomImageUrl(imageUrl))
        {
            error = "A valid HTTPS image URL is required for a custom category image.";
            return false;
        }

        return true;
    }

    private static bool IsValidCustomImageUrl(string? imageUrl) =>
        Uri.TryCreate(imageUrl?.Trim(), UriKind.Absolute, out var uri) &&
        uri.Scheme == Uri.UriSchemeHttps &&
        !string.IsNullOrWhiteSpace(uri.Host);

    private static bool IsSupportedProductImageUrl(string? imageUrl)
    {
        if (string.IsNullOrWhiteSpace(imageUrl)) return false;
        var value = imageUrl.Trim();
        if (value.StartsWith("/", StringComparison.Ordinal) || value.StartsWith("assets/", StringComparison.OrdinalIgnoreCase))
        {
            var localPath = value.TrimStart('/');
            return localPath.StartsWith("assets/", StringComparison.OrdinalIgnoreCase) &&
                !localPath.Split('/').Contains("..", StringComparer.Ordinal);
        }

        if (Uri.TryCreate(value, UriKind.Absolute, out var uri))
            return uri.Scheme is "http" or "https";

        return false;
    }

    private static List<string> ParseSizes(string json) => JsonSerializer.Deserialize<List<string>>(json) ?? [];
    private static SizeGuideDto? ParseGuide(string json) { try { return JsonSerializer.Deserialize<SizeGuideDto>(json, JsonSerializerOptions.Web); } catch { return null; } }
    private sealed record CategoryImageRow(int Id, string Name, string Slug, bool IsActive, string ImageMode, string? ImageUrl, bool RequiresSize, string SizeOptionsJson, string SizeGuideJson);
    private sealed record ProductImageCandidate(int CategoryId, string ImageUrl);
}
