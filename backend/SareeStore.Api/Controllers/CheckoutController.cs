using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SareeStore.Api.Data;
using SareeStore.Api.DTOs;

namespace SareeStore.Api.Controllers;

[ApiController, Route("api/checkout"), Authorize]
public class CheckoutController(AppDbContext db) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<ActionResult> Summary()
    {
        var userId = ApiHelper.UserId(User);
        var cartItems = await db.CartItems
            .Where(x => x.UserId == userId)
            .Include(x => x.Product)
            .ToListAsync();

        var subtotal = cartItems.Sum(x => (x.Product.DiscountPrice ?? x.Product.Price) * x.Quantity);
        var discountAmount = cartItems.Sum(x => Math.Max(0m, x.Product.Price - (x.Product.DiscountPrice ?? x.Product.Price)) * x.Quantity);
        var deliveryCharge = await db.ApplicationSettings
            .Where(x => x.Key == "DeliveryCharge")
            .Select(x => x.Value)
            .FirstOrDefaultAsync();

        var total = subtotal - discountAmount + deliveryCharge;
        return Ok(new CheckoutSummaryResponse(subtotal, discountAmount, deliveryCharge, total));
    }
}
