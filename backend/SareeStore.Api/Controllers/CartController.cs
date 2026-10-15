using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SareeStore.Api.Data;
using SareeStore.Api.DTOs;
using SareeStore.Api.Models;
using SareeStore.Api.Services;

namespace SareeStore.Api.Controllers;

[ApiController, Route("api/cart"), Authorize]
public class CartController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult> Get()
    {
        var userId = ApiHelper.UserId(User);
        var items = await db.CartItems
            .Where(x => x.UserId == userId)
            .Include(x => x.Product)
                .ThenInclude(x => x.Category)
            .Include(x => x.Product)
                .ThenInclude(x => x.Images)
            .Include(x => x.Product)
                .ThenInclude(x => x.SizeVariants)
            .OrderBy(x => x.Id)
            .ToListAsync();

        var changed = false;
        foreach (var item in items.ToList())
        {
            var stock = AvailableStock(item);
            if (!item.Product.IsActive)
            {
                db.CartItems.Remove(item);
                items.Remove(item);
                changed = true;
                continue;
            }

            if (stock > 0 && item.Quantity > stock)
            {
                item.Quantity = stock;
                item.UpdatedAt = DateTime.UtcNow;
                changed = true;
            }
        }

        if (changed) await db.SaveChangesAsync();
        return Ok(items.Select(ToResponse).ToList());
    }

    [HttpPost("items")]
    public async Task<ActionResult> Add(AddCartItemRequest req)
    {
        var userId = ApiHelper.UserId(User);
        var product = await db.Products
            .Include(x => x.Category)
            .Include(x => x.Images)
            .Include(x => x.SizeVariants)
            .FirstOrDefaultAsync(x => x.Id == req.ProductId);

        if (product is null || !product.IsActive) return BadRequest("Product is unavailable.");
        var sizeCode = (req.SizeCode ?? "").Trim().ToUpperInvariant();
        if ((!product.Category.RequiresSize && sizeCode.Length != 0) || (product.Category.RequiresSize && !product.SizeVariants.Any(v => v.SizeCode == sizeCode))) return BadRequest("Invalid size selection.");
        var configuredSizes = System.Text.Json.JsonSerializer.Deserialize<List<string>>(product.Category.SizeOptionsJson) ?? [];
        if (product.Category.RequiresSize && !configuredSizes.Contains(sizeCode)) return BadRequest("Invalid size selection.");
        var stock = product.Category.RequiresSize ? product.SizeVariants.FirstOrDefault(v => v.SizeCode == sizeCode && v.IsEnabled)?.Stock ?? 0 : product.Stock;
        if (product.Category.RequiresSize && string.IsNullOrEmpty(sizeCode)) return BadRequest("Select a size.");
        if (stock <= 0) return BadRequest("Selected size is unavailable.");

        var item = await db.CartItems.FirstOrDefaultAsync(x => x.UserId == userId && x.ProductId == req.ProductId && x.SizeCode == sizeCode);
        if (item is null)
        {
            item = new CartItem
            {
                UserId = userId,
                ProductId = product.Id,
                SizeCode = sizeCode,
                Quantity = Math.Min(req.Quantity, stock),
                Product = product
            };
            db.CartItems.Add(item);
        }
        else
        {
            item.Product = product;
            if (item.Quantity + req.Quantity > stock)
                return BadRequest($"Only {stock} item(s) are available for the selected size.");
            item.Quantity += req.Quantity;
            item.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();
        return Ok(ToResponse(item));
    }

    [HttpPut("items/{productId:int}")]
    public async Task<ActionResult> Update(int productId, UpdateCartItemRequest req)
    {
        var userId = ApiHelper.UserId(User);
        var item = await db.CartItems
            .Include(x => x.Product)
                .ThenInclude(x => x.Category)
            .Include(x => x.Product)
                .ThenInclude(x => x.Images)
            .Include(x => x.Product).ThenInclude(x => x.SizeVariants)
            .FirstOrDefaultAsync(x => x.UserId == userId && x.ProductId == productId && x.SizeCode == (req.SizeCode ?? ""));

        if (item is null) return NotFound("Cart item not found.");
        if (!item.Product.IsActive) return BadRequest("Product is unavailable.");
        var stock = AvailableStock(item);
        if (item.Product.Category.RequiresSize && item.Product.Category.SizeOptionsJson.Length > 0 && !System.Text.Json.JsonSerializer.Deserialize<List<string>>(item.Product.Category.SizeOptionsJson)!.Contains(item.SizeCode)) return BadRequest("This size is no longer offered.");
        if (stock < req.Quantity) return BadRequest($"Only {stock} item(s) are available for the selected size.");

        item.Quantity = req.Quantity;
        item.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(ToResponse(item));
    }

    [HttpDelete("items/{productId:int}")]
    public async Task<ActionResult> Remove(int productId)
    {
        var userId = ApiHelper.UserId(User);
        var item = await db.CartItems.FirstOrDefaultAsync(x => x.UserId == userId && x.ProductId == productId && x.SizeCode == (Request.Query["sizeCode"].ToString() ?? ""));
        if (item is null) return NoContent();
        db.CartItems.Remove(item);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete]
    public async Task<ActionResult> Clear()
    {
        var userId = ApiHelper.UserId(User);
        var items = await db.CartItems.Where(x => x.UserId == userId).ToListAsync();
        if (items.Count > 0)
        {
            db.CartItems.RemoveRange(items);
            await db.SaveChangesAsync();
        }
        return NoContent();
    }

    [HttpPost("sync")]
    public async Task<ActionResult> Sync(List<CartLineRequest> lines)
    {
        if (lines.Count == 0) return await Get();
        if (lines.Count > 100) return BadRequest("Too many cart items.");

        var userId = ApiHelper.UserId(User);
        var requested = CartLineGrouping.Group(lines);

        var productIds = requested.Keys.Select(x => x.ProductId).Distinct().ToList();
        var products = await db.Products
            .Include(x => x.Category)
            .Include(x => x.Images)
            .Include(x => x.SizeVariants)
            .Where(x => productIds.Contains(x.Id) && x.IsActive)
            .ToListAsync();

        foreach (var (key, quantity) in requested)
        {
            var product = products.FirstOrDefault(x => x.Id == key.ProductId);
            if (product is null) continue;
            var stock = product.Category.RequiresSize ? product.SizeVariants.FirstOrDefault(v => v.SizeCode == key.SizeCode && v.IsEnabled)?.Stock ?? 0 : product.Stock;
            var configuredSizes = System.Text.Json.JsonSerializer.Deserialize<List<string>>(product.Category.SizeOptionsJson) ?? [];
            if (product.Category.RequiresSize && !configuredSizes.Contains(key.SizeCode)) continue;
            if (!product.Category.RequiresSize && key.SizeCode.Length > 0) continue;
            if ((product.Category.RequiresSize && key.SizeCode == "") || stock <= 0) continue;

            var item = await db.CartItems.FirstOrDefaultAsync(x => x.UserId == userId && x.ProductId == key.ProductId && x.SizeCode == key.SizeCode);
            var target = Math.Min(quantity, stock);
            if (item is null)
            {
                db.CartItems.Add(new CartItem
                {
                    UserId = userId,
                    ProductId = key.ProductId,
                    SizeCode = key.SizeCode,
                    Quantity = target
                });
            }
            else
            {
                item.Quantity = Math.Min(item.Quantity + target, stock);
                item.UpdatedAt = DateTime.UtcNow;
            }
        }

        await db.SaveChangesAsync();
        return await Get();
    }

    private static CartItemResponse ToResponse(CartItem item) =>
        new(
            item.ProductId,
            item.Quantity,
            new ProductResponse(
                item.Product.Id,
                item.Product.CategoryId,
                item.Product.Category.Name,
                item.Product.Name,
                item.Product.Slug,
                item.Product.Description,
                item.Product.Price,
                item.Product.DiscountPrice,
                item.Product.Stock,
                item.Product.IsActive,
                item.Product.Images.OrderByDescending(i => i.IsPrimary).Select(i => i.ImageUrl).ToList(), item.Product.Category.RequiresSize,
                System.Text.Json.JsonSerializer.Deserialize<List<string>>(item.Product.Category.SizeOptionsJson) ?? [],
                item.Product.SizeVariants.Select(v => new ProductVariantResponse(v.SizeCode, v.Stock, v.IsEnabled, v.Stock > 0 && v.IsEnabled)).ToList(), item.Product.Category.SizeGuideJson
            ), item.SizeCode
        );

    private static int AvailableStock(CartItem item)
    {
        if (!item.Product.Category.RequiresSize) return item.Product.Stock;
        var sizes = System.Text.Json.JsonSerializer.Deserialize<List<string>>(item.Product.Category.SizeOptionsJson) ?? [];
        return sizes.Contains(item.SizeCode) ? item.Product.SizeVariants.FirstOrDefault(v => v.SizeCode == item.SizeCode && v.IsEnabled)?.Stock ?? 0 : 0;
    }
}

public record AddCartItemRequest([System.ComponentModel.DataAnnotations.Range(1, int.MaxValue)] int ProductId, [System.ComponentModel.DataAnnotations.Range(1, 50)] int Quantity, string? SizeCode = null);
