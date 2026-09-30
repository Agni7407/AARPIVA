using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SareeStore.Api.Data;
using SareeStore.Api.DTOs;
using SareeStore.Api.Models;
using SareeStore.Api.Services;

namespace SareeStore.Api.Controllers;
[ApiController, Authorize(Policy="Admin"), Route("api/admin")]
public class AdminController(AppDbContext db, INotificationService notifications) : ControllerBase
{
    [HttpGet("dashboard")]
    public async Task<ActionResult> Dashboard()=>Ok(new {customers=await db.Users.CountAsync(x=>x.Role==UserRole.Customer),products=await db.Products.CountAsync(x=>x.IsActive),categories=await db.Categories.CountAsync(x=>x.IsActive),orders=await db.Orders.CountAsync(),paidRevenue=await db.Orders.Where(x=>x.PaymentStatus==PaymentStatus.Paid).SumAsync(x=>(decimal?)x.TotalAmount)??0});
    [HttpGet("orders")]
    public async Task<ActionResult> Orders() => Ok(await db.Orders
        .Include(x => x.User)
        .Include(x => x.Address)
        .Include(x => x.Items)
        .OrderByDescending(x => x.CreatedAt)
        .Select(x => new
        {
            x.Id,
            customer = x.User.Name,
            email = x.User.Email,
            x.TotalAmount,
            x.Status,
            x.PaymentStatus,
            x.CreatedAt,
            address = new
            {
                x.Address.RecipientName,
                x.Address.Phone,
                x.Address.AddressLine1,
                x.Address.AddressLine2,
                x.Address.City,
                x.Address.State,
                x.Address.Pincode
            },
            items = x.Items.OrderBy(i => i.Id).Select(i => new
            {
                i.ProductId,
                i.ProductName,
                i.Quantity,
                i.UnitPrice,
                lineTotal = i.UnitPrice * i.Quantity
            })
        })
        .ToListAsync());
    [HttpPut("orders/{id:int}/status")]
    public async Task<ActionResult> Status(int id, UpdateOrderStatusRequest req)
    {
        var o = await db.Orders
            .Include(x => x.User)
            .Include(x => x.Address)
            .Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (o is null) return NotFound();
        o.Status = req.Status;
        await db.SaveChangesAsync();
        await notifications.SendOrderStatusAsync(o);
        return Ok();
    }
    [HttpGet("returns")]
    public async Task<ActionResult> Returns() => Ok(await db.ReturnRequests
        .Include(x => x.User)
        .Include(x => x.Order)
        .Include(x => x.OrderItem)
        .OrderByDescending(x => x.CreatedAt)
        .Select(x => new
        {
            x.Id,
            x.OrderId,
            customer = x.User.Name,
            email = x.User.Email,
            productName = x.OrderItem.ProductName,
            productId = x.OrderItem.ProductId,
            x.Quantity,
            x.Reason,
            x.Status,
            x.AdminNote,
            x.CreatedAt,
            x.UpdatedAt,
            orderStatus = x.Order.Status,
            paymentStatus = x.Order.PaymentStatus
        })
        .ToListAsync());

    [HttpPut("returns/{id:int}/status")]
    public async Task<ActionResult> ReturnStatus(int id, UpdateReturnStatusRequest req)
    {
        var r = await db.ReturnRequests
            .Include(x => x.Order)
            .Include(x => x.OrderItem)
            .Include(x => x.User)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (r is null) return NotFound();
        r.Status = req.Status;
        r.AdminNote = (req.AdminNote ?? "").Trim();
        r.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        await notifications.SendReturnStatusAsync(r);
        return Ok();
    }

    [HttpGet("customers")]
    public async Task<ActionResult> Customers()=>Ok(await db.Users.Where(x=>x.Role==UserRole.Customer).OrderByDescending(x=>x.CreatedAt).Select(x=>new{x.Id,x.Name,x.Email,x.IsEmailVerified,x.CreatedAt}).ToListAsync());
}
