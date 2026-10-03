using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SareeStore.Api.Data;
using SareeStore.Api.DTOs;
using SareeStore.Api.Models;

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
            .OrderBy(x => x.Id)
            .ToListAsync();

        var changed = false;
        foreach (var item in items.ToList())
        {
            if (!item.Product.IsActive || item.Product.Stock <= 0)
            {
                db.CartItems.Remove(item);
                items.Remove(item);
                changed = true;
                continue;
            }

            if (item.Quantity > item.Product.Stock)
            {
                item.Quantity = item.Product.Stock;
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
            .FirstOrDefaultAsync(x => x.Id == req.ProductId);

        if (product is null || !product.IsActive) return BadRequest("Product is unavailable.");
        if (product.Stock <= 0) return BadRequest("Product is out of stock.");

        var item = await db.CartItems.FirstOrDefaultAsync(x => x.UserId == userId && x.ProductId == req.ProductId);
        if (item is null)
        {
            item = new CartItem
            {
                UserId = userId,
                ProductId = product.Id,
                Quantity = Math.Min(req.Quantity, product.Stock),
                Product = product
            };
            db.CartItems.Add(item);
        }
        else
        {
            item.Product = product;
        {
            if (item.Quantity + req.Quantity > product.Stock)
                return BadRequest($"Only {product.Stock} item(s) are available.");
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
            .FirstOrDefaultAsync(x => x.UserId == userId && x.ProductId == productId);

        if (item is null) return NotFound("Cart item not found.");
        if (!item.Product.IsActive) return BadRequest("Product is unavailable.");
        if (item.Product.Stock < req.Quantity) return BadRequest($"Only {item.Product.Stock} item(s) are available.");

        item.Quantity = req.Quantity;
        item.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(ToResponse(item));
    }

    [HttpDelete("items/{productId:int}")]
    public async Task<ActionResult> Remove(int productId)
    {
        var userId = ApiHelper.UserId(User);
        var item = await db.CartItems.FirstOrDefaultAsync(x => x.UserId == userId && x.ProductId == productId);
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
        var requested = lines
            .GroupBy(x => x.ProductId)
            .ToDictionary(x => x.Key, x => x.Sum(v => v.Quantity));

        var productIds = requested.Keys.ToList();
        var products = await db.Products
            .Include(x => x.Category)
            .Include(x => x.Images)
            .Where(x => productIds.Contains(x.Id) && x.IsActive)
            .ToListAsync();

        foreach (var (productId, quantity) in requested)
        {
            var product = products.FirstOrDefault(x => x.Id == productId);
            if (product is null || product.Stock <= 0) continue;

            var item = await db.CartItems.FirstOrDefaultAsync(x => x.UserId == userId && x.ProductId == productId);
            var target = Math.Min(quantity, product.Stock);
            if (item is null)
            {
                db.CartItems.Add(new CartItem
                {
                    UserId = userId,
                    ProductId = productId,
                    Quantity = target
                });
            }
            else
            {
                item.Quantity = Math.Min(item.Quantity + target, product.Stock);
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
                item.Product.Images.OrderByDescending(i => i.IsPrimary).Select(i => i.ImageUrl).ToList()
            )
        );
}

public record AddCartItemRequest([System.ComponentModel.DataAnnotations.Range(1, int.MaxValue)] int ProductId, [System.ComponentModel.DataAnnotations.Range(1, 50)] int Quantity);
