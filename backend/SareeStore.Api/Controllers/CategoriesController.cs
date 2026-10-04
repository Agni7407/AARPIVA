using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SareeStore.Api.Data;
using SareeStore.Api.DTOs;

namespace SareeStore.Api.Controllers;

[ApiController, Route("api/categories")]
public class CategoriesController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult> Get(CancellationToken cancellationToken)
    {
        var categories = await db.Categories.AsNoTracking()
        .Where(x => x.IsActive)
        .OrderBy(x => x.Name)
        .Select(x => new CategoryImageRow(x.Id, x.Name, x.Slug, x.IsActive, x.ImageMode, x.ImageUrl))
        .ToListAsync(cancellationToken);

        var productImages = await FirstProductImagesAsync(categories, cancellationToken);
        return Ok(categories.Select(category => new CategoryResponse(
            category.Id,
            category.Name,
            category.Slug,
            category.IsActive,
            ResolvedImage(category, productImages))).ToList());
    }

    [Authorize(Policy = "Admin"), HttpGet("admin")]
    public async Task<ActionResult> GetAdmin(CancellationToken cancellationToken)
    {
        var categories = await db.Categories.AsNoTracking()
        .OrderBy(x => x.Name)
        .Select(x => new CategoryImageRow(x.Id, x.Name, x.Slug, x.IsActive, x.ImageMode, x.ImageUrl))
        .ToListAsync(cancellationToken);

        var productImages = await FirstProductImagesAsync(categories, cancellationToken, includeCustomCategories: true);
        return Ok(categories.Select(category => ToAdminResponse(category, productImages)).ToList());
    }

    [Authorize(Policy = "Admin"), HttpPost]
    public async Task<ActionResult> Create(CategoryRequest req, CancellationToken cancellationToken)
    {
        var name = req.Name.Trim();
        if (string.IsNullOrWhiteSpace(name)) return BadRequest("Category name is required.");
        if (!TryNormalizeImageSettings(req, out var imageMode, out var imageUrl, out var imageError))
            return BadRequest(imageError);
        var slug = ApiHelper.Slug(name);
        if (await db.Categories.AnyAsync(x => x.Slug == slug, cancellationToken)) return Conflict("Category already exists.");
        var c = new Models.Category { Name = name, Slug = slug, IsActive = req.IsActive, ImageMode = imageMode, ImageUrl = imageUrl };
        db.Categories.Add(c);
        await db.SaveChangesAsync(cancellationToken);
        return Ok(await ToAdminResponseAsync(c, cancellationToken));
    }

    [Authorize(Policy = "Admin"), HttpPut("{id:int}")]
    public async Task<ActionResult> Update(int id, CategoryRequest req, CancellationToken cancellationToken)
    {
        var c = await db.Categories.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (c is null) return NotFound();
        var name = req.Name.Trim();
        if (string.IsNullOrWhiteSpace(name)) return BadRequest("Category name is required.");
        if (!TryNormalizeImageSettings(req, out var imageMode, out var imageUrl, out var imageError))
            return BadRequest(imageError);
        var slug = ApiHelper.Slug(name);
        if (await db.Categories.AnyAsync(x => x.Id != id && x.Slug == slug, cancellationToken)) return Conflict("Category already exists.");
        c.Name = name;
        c.Slug = slug;
        c.IsActive = req.IsActive;
        c.ImageMode = imageMode;
        c.ImageUrl = imageUrl;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(await ToAdminResponseAsync(c, cancellationToken));
    }

    [Authorize(Policy = "Admin"), HttpDelete("{id:int}")]
    public async Task<ActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var c = await db.Categories.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (c is null) return NotFound();
        var has = await db.Products.AnyAsync(p => p.CategoryId == id, cancellationToken);
        if (has)
        {
            c.IsActive = false;
            await db.SaveChangesAsync(cancellationToken);
            return Ok(new { message = "Category deactivated because it has products." });
        }
        db.Categories.Remove(c);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
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
        var row = new CategoryImageRow(category.Id, category.Name, category.Slug, category.IsActive, category.ImageMode, category.ImageUrl);
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
            resolvedImageUrl);
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

    private sealed record CategoryImageRow(int Id, string Name, string Slug, bool IsActive, string ImageMode, string? ImageUrl);
    private sealed record ProductImageCandidate(int CategoryId, string ImageUrl);
}
