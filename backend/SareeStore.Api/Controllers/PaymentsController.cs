using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SareeStore.Api.Data;
using SareeStore.Api.DTOs;
using SareeStore.Api.Models;
using SareeStore.Api.Services;
using System.Data;

namespace SareeStore.Api.Controllers;
[ApiController, Authorize, Route("api/payments")]
public class PaymentsController(AppDbContext db, IRazorpayService razorpay, IConfiguration cfg, INotificationService notifications, ILogger<PaymentsController> logger) : ControllerBase
{
    [HttpPost("create-order")]
    public async Task<ActionResult> Create(CreateRazorpayOrderRequest req)
    {
        var order = await db.Orders.Include(x => x.Payment).FirstOrDefaultAsync(x => x.Id == req.OrderId && x.UserId == ApiHelper.UserId(User));
        if (order is null) return NotFound();
        if (order.PaymentStatus == PaymentStatus.Paid) return BadRequest("Order already paid.");
        if (order.PaymentStatus != PaymentStatus.Pending || order.Status != OrderStatus.Pending)
            return BadRequest("This payment attempt is no longer active.");
        if (order.StockReserved && order.ReservationExpiresAt <= DateTime.UtcNow) return BadRequest("The inventory reservation expired. Please start checkout again.");

        var (id, amount) = await razorpay.CreateOrderAsync((long)(order.TotalAmount * 100m), $"order_{order.Id}");
        order.RazorpayOrderId = id;
        if (order.Payment is null)
            order.Payment = new Payment { OrderId = order.Id, RazorpayOrderId = id, Amount = order.TotalAmount };
        else
        {
            order.Payment.RazorpayOrderId = id;
            order.Payment.Amount = order.TotalAmount;
            order.Payment.Status = PaymentStatus.Pending;
        }
        await db.SaveChangesAsync();
        return Ok(new {keyId=cfg["Razorpay:KeyId"],razorpayOrderId=id,amount,currency="INR",orderId=order.Id});
    }
    [HttpPost("cancel")]
    public async Task<ActionResult> Cancel([FromBody] CancelPaymentRequest req)
    {
        var exists = await db.Orders.AnyAsync(x => x.Id == req.OrderId && x.UserId == ApiHelper.UserId(User));
        if (!exists) return NotFound("Order not found.");
        var released = await InventoryReservationOperations.ReleasePendingAsync(db, req.OrderId, onlyIfExpired: false, HttpContext.RequestAborted);
        var status = await db.Orders.Where(x => x.Id == req.OrderId).Select(x => x.PaymentStatus).FirstAsync();
        if (status == PaymentStatus.Paid || status == PaymentStatus.PaidNeedsRefund) return Ok(new { message = "Payment was already captured and is being reconciled." });
        return Ok(new { message = released ? "Payment cancelled and reserved stock released. Your items are still in your bag." : "Payment attempt was already closed." });
    }

    [HttpPost("verify")]
    public async Task<ActionResult> Verify(VerifyPaymentRequest req)
    {
        var order=await db.Orders.Include(x=>x.Payment).Include(x=>x.User).FirstOrDefaultAsync(x=>x.Id==req.OrderId&&x.UserId==ApiHelper.UserId(User)); if(order is null)return NotFound();
        if(PaymentVerificationRules.IsFinalized(order.PaymentStatus)) return Ok(new {message="Payment already processed.", needsRefund=order.PaymentStatus==PaymentStatus.PaidNeedsRefund});
        if(order.RazorpayOrderId!=req.RazorpayOrderId)return BadRequest("Razorpay order mismatch."); if(!razorpay.VerifySignature(order.RazorpayOrderId!,req.RazorpayPaymentId,req.RazorpaySignature))return BadRequest("Payment signature verification failed.");
        if (order.StockReserved && order.ReservationExpiresAt <= DateTime.UtcNow)
            await InventoryReservationOperations.ReleasePendingAsync(db, order.Id, onlyIfExpired: true, HttpContext.RequestAborted);
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT \"Id\" FROM \"Orders\" WHERE \"Id\" = {order.Id} FOR UPDATE");
        await db.Entry(order).ReloadAsync();
        if (PaymentVerificationRules.IsFinalized(order.PaymentStatus))
        {
            await transaction.CommitAsync();
            return Ok(new { message = "Payment already verified." });
        }
        if (order.RazorpayOrderId != req.RazorpayOrderId) return BadRequest("Razorpay order mismatch.");
        var lines = await db.OrderItems.Where(x => x.OrderId == order.Id).ToListAsync();
        var productIds = lines.Select(x => x.ProductId).Distinct().ToList();
        var needsRefund = false;
        if (!order.StockReserved)
        {
            foreach (var productId in productIds.Order())
                await db.Database.ExecuteSqlInterpolatedAsync($"SELECT \"Id\" FROM \"Products\" WHERE \"Id\" = {productId} FOR UPDATE");
            var products = await db.Products.Include(x => x.Category).Include(x => x.SizeVariants).Where(x => productIds.Contains(x.Id)).ToListAsync();
            foreach (var product in products)
            {
                await db.Entry(product).ReloadAsync();
                db.Entry(product).Collection(x => x.SizeVariants).IsLoaded = false;
                await db.Entry(product).Collection(x => x.SizeVariants).LoadAsync();
            }
            var availability = lines.Select(line =>
            {
                var p = products.First(x => x.Id == line.ProductId);
                if (line.RequiresSize)
                {
                    var variant = p.SizeVariants.FirstOrDefault(v => v.SizeCode == line.SizeCode);
                    return (Available: variant?.Stock ?? 0, Requested: line.Quantity);
                }
                return (Available: p.Stock, Requested: line.Quantity);
            }).ToList();
            needsRefund = !SizeManagementRules.CanAcquireAll(availability);
            if (!needsRefund)
            {
                foreach (var line in lines)
                {
                    var p = products.First(x => x.Id == line.ProductId);
                    if (line.RequiresSize) p.SizeVariants.First(v => v.SizeCode == line.SizeCode).Stock -= line.Quantity;
                    else p.Stock -= line.Quantity;
                }
            }
        }
        order.StockReserved = false;
        order.ReservationExpiresAt = null;
        order.PaymentStatus = needsRefund ? PaymentStatus.PaidNeedsRefund : PaymentStatus.Paid;
        order.Status = needsRefund ? OrderStatus.Cancelled : OrderStatus.Confirmed;
        if(order.Payment is null)order.Payment=new Payment{OrderId=order.Id,RazorpayOrderId=req.RazorpayOrderId,Amount=order.TotalAmount}; order.Payment.RazorpayPaymentId=req.RazorpayPaymentId; order.Payment.RazorpaySignature=req.RazorpaySignature; order.Payment.Status=order.PaymentStatus;

        if (needsRefund)
        {
            await db.SaveChangesAsync();
            await transaction.CommitAsync();
            await notifications.SendSafeAsync(order.User.Email, $"AARPIVA payment update for order #{order.Id}", $"<p>Payment for order #{order.Id} was captured, but the order could not be fulfilled. Please contact AARPIVA support to arrange a refund.</p>");
            var operationsEmail = cfg["Operations:RefundAlertEmail"] ?? cfg["SeedAdmin:Email"];
            if (!string.IsNullOrWhiteSpace(operationsEmail))
                await notifications.SendSafeAsync(operationsEmail, $"Action required: refund follow-up for order #{order.Id}", $"<p>Razorpay captured payment for order <strong>#{order.Id}</strong>, but the requested size was unavailable and no stock was deducted.</p><p>Amount: ₹{order.TotalAmount:N2}. Payment ID: {System.Net.WebUtility.HtmlEncode(req.RazorpayPaymentId)}.</p><p>Review the order in the AARPIVA admin orders page and record the provider refund reference after completing the refund.</p>");
            else
                logger.LogWarning("Order {OrderId} requires refund follow-up, but Operations:RefundAlertEmail and SeedAdmin:Email are not configured. The case remains visible in the admin refund queue.", order.Id);
            return Ok(new { message = "Payment was captured, but the order could not be fulfilled. A refund follow-up is required.", needsRefund = true });
        }

        var orderedItems = lines.Select(x => new { x.ProductId, x.Quantity, x.SizeCode }).ToList();
        foreach (var orderedItem in orderedItems)
        {
            var cartItem = await db.CartItems.FirstOrDefaultAsync(x => x.UserId == order.UserId && x.ProductId == orderedItem.ProductId && x.SizeCode == orderedItem.SizeCode);
            if (cartItem is null) continue;
            cartItem.Quantity -= orderedItem.Quantity;
            cartItem.UpdatedAt = DateTime.UtcNow;
            if (cartItem.Quantity <= 0) db.CartItems.Remove(cartItem);
        }

        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        var notificationOrder = await db.Orders.Include(x=>x.User).Include(x=>x.Items).Include(x=>x.Address).FirstAsync(x=>x.Id==order.Id);
        await notifications.SendPaymentSuccessAsync(notificationOrder);
        return Ok(new {message="Payment verified successfully.", needsRefund=false});
    }
}
