using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SareeStore.Api.Data;
using SareeStore.Api.DTOs;
using SareeStore.Api.Models;

namespace SareeStore.Api.Controllers;

[ApiController, Route("api/products")]
public class ProductsController(AppDbContext db) : ControllerBase
{
    private IQueryable<Product> Query(bool includeInactive = false) =>
        db.Products
            .Include(x => x.Category)
            .Include(x => x.Images)
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

        return Ok(await q.OrderByDescending(x => x.CreatedAt).Select(ToResponse()).ToListAsync());
    }

    [Authorize(Policy = "Admin"), HttpGet("admin")]
    public async Task<ActionResult> GetAdmin() => Ok(await Query(includeInactive: true)
        .OrderByDescending(x => x.CreatedAt)
        .Select(ToResponse())
        .ToListAsync());

    [HttpGet("{id:int}")]
    public async Task<ActionResult> GetOne(int id)
    {
        var p = await Query().FirstOrDefaultAsync(x => x.Id == id);
        return p is null ? NotFound() : Ok(ToResponse().Compile()(p));
    }

    [Authorize(Policy = "Admin"), HttpPost]
    public async Task<ActionResult> Create(ProductRequest req)
    {
        if (!await db.Categories.AnyAsync(x => x.Id == req.CategoryId && x.IsActive))
            return BadRequest("Invalid or inactive category.");

        if (req.DiscountPrice.HasValue && req.DiscountPrice.Value > req.Price)
            return BadRequest("Discount price cannot be greater than the regular price.");

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

        db.Products.Add(p);
        await db.SaveChangesAsync();
        await db.Entry(p).Reference(x => x.Category).LoadAsync();
        return Ok(ToResponse().Compile()(p));
    }

    [Authorize(Policy = "Admin"), HttpPut("{id:int}")]
    public async Task<ActionResult> Update(int id, ProductRequest req)
    {
        var p = await db.Products.Include(x => x.Images).Include(x => x.Category).FirstOrDefaultAsync(x => x.Id == id);
        if (p is null) return NotFound();
        if (!await db.Categories.AnyAsync(x => x.Id == req.CategoryId)) return BadRequest("Invalid category.");
        if (req.DiscountPrice.HasValue && req.DiscountPrice.Value > req.Price) return BadRequest("Discount price cannot be greater than the regular price.");

        var name = req.Name.Trim();
        if (string.IsNullOrWhiteSpace(name)) return BadRequest("Product name is required.");

        p.CategoryId = req.CategoryId;
        p.Name = name;
        p.Slug = await UniqueSlugAsync(name, p.Id);
        p.Description = req.Description?.Trim() ?? "";
        p.Price = req.Price;
        p.DiscountPrice = req.DiscountPrice;
        p.Stock = req.Stock;
        p.IsActive = req.IsActive;
        db.ProductImages.RemoveRange(p.Images);
        p.Images = BuildImages(req.ImageUrls);

        await db.SaveChangesAsync();
        await db.Entry(p).Reference(x => x.Category).LoadAsync();
        return Ok(ToResponse().Compile()(p));
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

    private static System.Linq.Expressions.Expression<Func<Product, ProductResponse>> ToResponse() =>
        p => new ProductResponse(
            p.Id, p.CategoryId, p.Category.Name, p.Name, p.Slug, p.Description, p.Price, p.DiscountPrice, p.Stock, p.IsActive,
            p.Images.OrderByDescending(i => i.IsPrimary).Select(i => i.ImageUrl).ToList());
}
