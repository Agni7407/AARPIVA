using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SareeStore.Api.Data;
using SareeStore.Api.DTOs;
using SareeStore.Api.Models;
using SareeStore.Api.Services;

namespace SareeStore.Api.Controllers;
[ApiController, Authorize, Route("api/payments")]
public class PaymentsController(AppDbContext db, IRazorpayService razorpay, IConfiguration cfg, INotificationService notifications) : ControllerBase
{
    [HttpPost("create-order")]
    public async Task<ActionResult> Create(CreateRazorpayOrderRequest req)
    {
        var order=await db.Orders.FirstOrDefaultAsync(x=>x.Id==req.OrderId&&x.UserId==ApiHelper.UserId(User)); if(order is null)return NotFound(); if(order.PaymentStatus==PaymentStatus.Paid)return BadRequest("Order already paid.");
        var (id, amount)=await razorpay.CreateOrderAsync((long)(order.TotalAmount*100m), $"order_{order.Id}"); order.RazorpayOrderId=id; if(order.Payment is null)order.Payment=new Payment{OrderId=order.Id,RazorpayOrderId=id,Amount=order.TotalAmount}; await db.SaveChangesAsync();
        return Ok(new {keyId=cfg["Razorpay:KeyId"],razorpayOrderId=id,amount,currency="INR",orderId=order.Id});
    }
    [HttpPost("verify")]
    public async Task<ActionResult> Verify(VerifyPaymentRequest req)
    {
        var order=await db.Orders.Include(x=>x.Payment).FirstOrDefaultAsync(x=>x.Id==req.OrderId&&x.UserId==ApiHelper.UserId(User)); if(order is null)return NotFound();
        if(order.PaymentStatus==PaymentStatus.Paid) return Ok(new {message="Payment already verified."});
        if(order.RazorpayOrderId!=req.RazorpayOrderId)return BadRequest("Razorpay order mismatch."); if(!razorpay.VerifySignature(order.RazorpayOrderId!,req.RazorpayPaymentId,req.RazorpaySignature))return BadRequest("Payment signature verification failed.");
        var productIds = await db.OrderItems.Where(x => x.OrderId == order.Id).Select(x => new { x.ProductId, x.Quantity }).ToListAsync();
        var products = await db.Products.Where(x => productIds.Select(i => i.ProductId).Contains(x.Id)).ToListAsync();
        foreach (var line in productIds) { var p = products.First(x => x.Id == line.ProductId); if (p.Stock < line.Quantity) return BadRequest("One or more products went out of stock before payment confirmation."); p.Stock -= line.Quantity; }
        order.PaymentStatus=PaymentStatus.Paid; order.Status=OrderStatus.Confirmed; if(order.Payment is null)order.Payment=new Payment{OrderId=order.Id,RazorpayOrderId=req.RazorpayOrderId,Amount=order.TotalAmount}; order.Payment.RazorpayPaymentId=req.RazorpayPaymentId; order.Payment.RazorpaySignature=req.RazorpaySignature; order.Payment.Status=PaymentStatus.Paid; await db.SaveChangesAsync();
        var notificationOrder = await db.Orders.Include(x=>x.User).Include(x=>x.Items).Include(x=>x.Address).FirstAsync(x=>x.Id==order.Id);
        await notifications.SendPaymentSuccessAsync(notificationOrder);
        return Ok(new {message="Payment verified successfully."});
    }
}
