using System.ComponentModel.DataAnnotations;
using SareeStore.Api.Models;

namespace SareeStore.Api.DTOs;

public record RegisterRequest([Required, MinLength(2)] string Name, [Required, EmailAddress] string Email, [Required, MinLength(8)] string Password);
public record LoginRequest([Required, EmailAddress] string Email, [Required] string Password);
public record AuthResponse(string Token, int UserId, string Name, string Email, string Role, bool IsEmailVerified);
public record VerifyEmailRequest([Required] string Token);
public record ResendVerificationRequest([Required, EmailAddress] string Email);
public record VerifyOtpRequest([Required, EmailAddress] string Email, [Required, RegularExpression("^[0-9]{6}$")] string Otp);
public record ResendOtpRequest([Required, EmailAddress] string Email);

public record CategoryRequest([Required, MinLength(2)] string Name, bool IsActive = true);
public record CategoryResponse(int Id, string Name, string Slug, bool IsActive);

public record ProductRequest([Required, MinLength(2)] string Name, [Required] int CategoryId, string Description, [Range(0, double.MaxValue)] decimal Price, [Range(0, double.MaxValue)] decimal? DiscountPrice, [Range(0, int.MaxValue)] int Stock, bool IsActive = true, List<string>? ImageUrls = null);
public record ProductResponse(int Id, int CategoryId, string CategoryName, string Name, string Slug, string Description, decimal Price, decimal? DiscountPrice, int Stock, bool IsActive, List<string> Images);

public record AddressRequest([Required] string RecipientName, [Required] string Phone, [Required] string AddressLine1, string AddressLine2, [Required] string City, [Required] string State, [Required] string Pincode);
public record AddressResponse(int Id, string RecipientName, string Phone, string AddressLine1, string AddressLine2, string City, string State, string Pincode);

public record CreateOrderRequest([Required] int AddressId);
public record CartItemResponse(int ProductId, int Quantity, ProductResponse Product);
public record UpdateCartItemRequest([Range(1, 50)] int Quantity);
public record CartLineRequest([Required] int ProductId, [Range(1, 50)] int Quantity);
public record CreateRazorpayOrderRequest([Required] int OrderId);
public record CancelPaymentRequest([Required] int OrderId);
public record VerifyPaymentRequest([Required] int OrderId, [Required] string RazorpayOrderId, [Required] string RazorpayPaymentId, [Required] string RazorpaySignature);
public record UpdateOrderStatusRequest(OrderStatus Status);
public record CreateReturnRequest([Required] int OrderItemId, [Range(1, 50)] int Quantity, [Required, MinLength(3)] string Reason);
public record UpdateReturnStatusRequest(ReturnStatus Status, string? AdminNote);
public record ReturnRequestResponse(int Id, int OrderId, int OrderItemId, int ProductId, string ProductName, int Quantity, string Reason, ReturnStatus Status, string AdminNote, DateTime CreatedAt, DateTime UpdatedAt);

public record OrderListResponse(int Id, decimal TotalAmount, OrderStatus Status, PaymentStatus PaymentStatus, DateTime CreatedAt, List<OrderItemResponse> Items, AddressResponse Address, List<ReturnRequestResponse> Returns);
public record OrderItemResponse(int Id, int ProductId, string ProductName, decimal UnitPrice, int Quantity);
