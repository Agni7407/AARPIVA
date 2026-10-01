using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SareeStore.Api.Data;
using SareeStore.Api.DTOs;
using SareeStore.Api.Models;
using SareeStore.Api.Services;

namespace SareeStore.Api.Controllers;

[ApiController, Route("api/orders"), Authorize]
public class OrdersController(AppDbContext db, INotificationService notifications) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult> Create(CreateOrderRequest req)
    {
        var userId = ApiHelper.UserId(User);
        var address = await db.Addresses.FirstOrDefaultAsync(x => x.Id == req.AddressId && x.UserId == userId);
        if (address is null) return BadRequest("Invalid shipping address.");

        var cartItems = await db.CartItems
            .Where(x => x.UserId == userId)
            .Include(x => x.Product)
            .ToListAsync();

        if (cartItems.Count == 0) return BadRequest("Your bag is empty.");

        var order = new Order { UserId = userId, AddressId = address.Id };
        foreach (var line in cartItems)
        {
            var p = line.Product;
            if (!p.IsActive) return BadRequest($"{p.Name} is no longer available.");
            if (p.Stock < line.Quantity) return BadRequest($"Insufficient stock for {p.Name}.");

            var price = p.DiscountPrice ?? p.Price;
            order.Items.Add(new OrderItem
            {
                ProductId = p.Id,
                ProductName = p.Name,
                UnitPrice = price,
                Quantity = line.Quantity
            });
            order.TotalAmount += price * line.Quantity;
        }

        if (order.TotalAmount < 1499m) order.TotalAmount += 99m;

        db.Orders.Add(order);
        await db.SaveChangesAsync();
        return Ok(await ToResponse(order.Id));
    }

    [HttpGet("mine")]
    public async Task<ActionResult> Mine()
    {
        var userId = ApiHelper.UserId(User);
        var orders = await db.Orders
            .Where(x => x.UserId == userId && (x.PaymentStatus == PaymentStatus.Paid || x.PaymentStatus == PaymentStatus.Refunded))
            .Include(x => x.Items)
            .Include(x => x.Address)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync();

        var orderIds = orders.Select(x => x.Id).ToList();
        var returns = await db.ReturnRequests.Where(x => orderIds.Contains(x.OrderId)).Include(x => x.OrderItem).ToListAsync();
        return Ok(orders.Select(o => ToResponse(o, returns.Where(r => r.OrderId == o.Id))).ToList());
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult> One(int id)
    {
        var o = await db.Orders
            .Where(x => x.Id == id && x.UserId == ApiHelper.UserId(User) && (x.PaymentStatus == PaymentStatus.Paid || x.PaymentStatus == PaymentStatus.Refunded))
            .Include(x => x.Items).Include(x => x.Address).FirstOrDefaultAsync();
        if (o is null) return NotFound();
        var returns = await db.ReturnRequests.Where(x => x.OrderId == id).Include(x => x.OrderItem).ToListAsync();
        return Ok(ToResponse(o, returns));
    }

    [HttpPost("{id:int}/returns")]
    public async Task<ActionResult> RequestReturn(int id, CreateReturnRequest req)
    {
        var userId = ApiHelper.UserId(User);
        var order = await db.Orders.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (order is null) return NotFound("Order not found.");
        if (order.Status != OrderStatus.Delivered) return BadRequest("Returns can be requested after an order is delivered.");
        if (order.PaymentStatus != PaymentStatus.Paid && order.PaymentStatus != PaymentStatus.Refunded) return BadRequest("Only paid orders can have a return request.");

        var item = order.Items.FirstOrDefault(x => x.Id == req.OrderItemId);
        if (item is null) return BadRequest("The selected order item was not found.");
        if (req.Quantity < 1 || req.Quantity > item.Quantity) return BadRequest("Invalid return quantity.");

        var activeStatuses = new[] { ReturnStatus.Requested, ReturnStatus.Approved, ReturnStatus.Received, ReturnStatus.Refunded };
        var alreadyRequested = await db.ReturnRequests.Where(x => x.OrderItemId == item.Id && activeStatuses.Contains(x.Status)).SumAsync(x => (int?)x.Quantity) ?? 0;
        if (alreadyRequested + req.Quantity > item.Quantity) return BadRequest("You have already requested the maximum return quantity for this item.");

        var request = new ReturnRequest
        {
            OrderId = order.Id,
            OrderItemId = item.Id,
            UserId = userId,
            Quantity = req.Quantity,
            Reason = req.Reason.Trim(),
            Status = ReturnStatus.Requested
        };
        db.ReturnRequests.Add(request);
        await db.SaveChangesAsync();
        await db.Entry(request).Reference(x => x.User).LoadAsync();
        await db.Entry(request).Reference(x => x.OrderItem).LoadAsync();
        await notifications.SendReturnRequestedAsync(request);
        return Ok(ToReturnResponse(request, item));
    }

    private async Task<OrderListResponse?> ToResponse(int id)
    {
        var o = await db.Orders.Where(x => x.Id == id).Include(x => x.Items).Include(x => x.Address).FirstOrDefaultAsync();
        if (o is null) return null;
        var returns = await db.ReturnRequests.Where(x => x.OrderId == id).Include(x => x.OrderItem).ToListAsync();
        return ToResponse(o, returns);
    }

    private static OrderListResponse ToResponse(Order o, IEnumerable<ReturnRequest> returns) =>
        new(o.Id, o.TotalAmount, o.Status, o.PaymentStatus, o.CreatedAt,
            o.Items.Select(i => new OrderItemResponse(i.Id, i.ProductId, i.ProductName, i.UnitPrice, i.Quantity)).ToList(),
            new AddressResponse(o.Address.Id, o.Address.RecipientName, o.Address.Phone, o.Address.AddressLine1, o.Address.AddressLine2, o.Address.City, o.Address.State, o.Address.Pincode),
            returns.Select(r => ToReturnResponse(r, o.Items.First(i => i.Id == r.OrderItemId))).ToList());

    private static ReturnRequestResponse ToReturnResponse(ReturnRequest r, OrderItem item) =>
        new(r.Id, r.OrderId, r.OrderItemId, item.ProductId, item.ProductName, r.Quantity, r.Reason, r.Status, r.AdminNote, r.CreatedAt, r.UpdatedAt);
}
