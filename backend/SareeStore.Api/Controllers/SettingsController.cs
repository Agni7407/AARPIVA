using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SareeStore.Api.Data;
using SareeStore.Api.DTOs;

namespace SareeStore.Api.Controllers;

[ApiController, Route("api/settings")]
public class SettingsController(AppDbContext db) : ControllerBase
{
    [HttpGet("delivery")]
    public async Task<ActionResult<DeliverySettingsResponse>> Delivery()
    {
        var values = await db.AppSettings.Where(x => x.Key == "DeliveryCharge" || x.Key == "FreeDeliveryThreshold").ToListAsync();
        var charge = values.FirstOrDefault(x => x.Key == "DeliveryCharge")?.Value ?? 99m;
        var threshold = values.FirstOrDefault(x => x.Key == "FreeDeliveryThreshold")?.Value ?? 1499m;
        return Ok(new DeliverySettingsResponse(charge, threshold));
    }
}
