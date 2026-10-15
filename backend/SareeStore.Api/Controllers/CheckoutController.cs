using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SareeStore.Api.Data;
using SareeStore.Api.DTOs;
using SareeStore.Api.Services;

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
        var settings = await db.AppSettings.Where(x => x.Key == "DeliveryCharge" || x.Key == "FreeDeliveryThreshold").ToListAsync();
        var configuredCharge = settings.FirstOrDefault(x => x.Key == "DeliveryCharge")?.Value ?? 99m;
        var freeThreshold = settings.FirstOrDefault(x => x.Key == "FreeDeliveryThreshold")?.Value ?? 1499m;
        var deliveryCharge = DeliveryPricing.Charge(subtotal, configuredCharge, freeThreshold);
        return Ok(new CheckoutSummaryResponse(subtotal, 0m, deliveryCharge, subtotal + deliveryCharge));
    }
}
