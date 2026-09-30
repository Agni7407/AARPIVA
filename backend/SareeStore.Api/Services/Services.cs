using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SareeStore.Api.Models;

namespace SareeStore.Api.Services;

public interface IEmailSender
{
    Task SendAsync(string to, string subject, string html);
}

public class EmailSender(IConfiguration cfg, IHttpClientFactory httpClientFactory, ILogger<EmailSender> logger) : IEmailSender
{
    public async Task SendAsync(string to, string subject, string html)
    {
        var mode = cfg["Email:Mode"] ?? "BrevoApi";
        if (mode.Equals("Console", StringComparison.OrdinalIgnoreCase))
        {
            logger.LogInformation("EMAIL TO {To} SUBJECT: {Subject}", to, subject);
            return;
        }

        if (mode.Equals("Smtp", StringComparison.OrdinalIgnoreCase))
        {
            await SendSmtpAsync(to, subject, html);
            return;
        }

        await SendBrevoApiAsync(to, subject, html);
    }

    private async Task SendBrevoApiAsync(string to, string subject, string html)
    {
        var apiKey = cfg["Brevo:ApiKey"];
        var fromEmail = cfg["Email:FromEmail"];
        var fromName = cfg["Email:FromName"] ?? "AARPIVA";

        if (string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(fromEmail))
            throw new InvalidOperationException("Brevo API email is selected but Brevo:ApiKey or Email:FromEmail is missing.");

        var client = httpClientFactory.CreateClient("brevo");
        using var request = new HttpRequestMessage(HttpMethod.Post, "/v3/smtp/email");
        request.Headers.Add("api-key", apiKey);
        request.Content = new StringContent(
            JsonSerializer.Serialize(new
            {
                sender = new { name = fromName, email = fromEmail },
                to = new[] { new { email = to } },
                subject,
                htmlContent = html
            }),
            Encoding.UTF8,
            "application/json");

        using var response = await client.SendAsync(request);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync();
            logger.LogError("Brevo email request failed with status {StatusCode}: {Body}", (int)response.StatusCode, body);
            throw new InvalidOperationException("Brevo email delivery failed.");
        }
    }

    private async Task SendSmtpAsync(string to, string subject, string html)
    {
        var host = cfg["Email:SmtpHost"];
        var user = cfg["Email:SmtpUser"];
        var password = cfg["Email:SmtpPassword"];
        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(user) || string.IsNullOrWhiteSpace(password))
            throw new InvalidOperationException("SMTP email is selected but Email:SmtpHost, Email:SmtpUser or Email:SmtpPassword is missing.");

        using var message = new System.Net.Mail.MailMessage();
        message.From = new System.Net.Mail.MailAddress(
            cfg["Email:FromEmail"] ?? throw new InvalidOperationException("Email:FromEmail is required."),
            cfg["Email:FromName"] ?? "AARPIVA");
        message.To.Add(to);
        message.Subject = subject;
        message.Body = html;
        message.IsBodyHtml = true;

        var port = int.TryParse(cfg["Email:SmtpPort"], out var smtpPort) ? smtpPort : 587;
        using var smtp = new System.Net.Mail.SmtpClient(host, port)
        {
            EnableSsl = bool.TryParse(cfg["Email:UseSsl"], out var ssl) ? ssl : port != 465,
            DeliveryMethod = System.Net.Mail.SmtpDeliveryMethod.Network,
            UseDefaultCredentials = false,
            Credentials = new System.Net.NetworkCredential(user, password)
        };

        await smtp.SendMailAsync(message);
    }
}

public static class OtpService
{
    public static string Generate() => RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
    public static string Hash(string otp) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(otp))).ToLowerInvariant();
}

public interface INotificationService
{
    Task SendSafeAsync(string to, string subject, string html);
    Task SendPaymentSuccessAsync(Order order);
    Task SendOrderStatusAsync(Order order);
    Task SendReturnRequestedAsync(ReturnRequest request);
    Task SendReturnStatusAsync(ReturnRequest request);
}

public class NotificationService(IEmailSender email, ILogger<NotificationService> logger) : INotificationService
{
    private static string Esc(string? value) => System.Net.WebUtility.HtmlEncode(value ?? "");
    private static string Money(decimal amount) => $"₹{amount:N2}";

    public async Task SendSafeAsync(string to, string subject, string html)
    {
        try { await email.SendAsync(to, subject, html); }
        catch (Exception ex) { logger.LogError(ex, "Email notification failed for {Recipient}. Subject: {Subject}", to, subject); }
    }

    public Task SendPaymentSuccessAsync(Order order)
    {
        var lines = string.Join("", order.Items.Select(i => $"<tr><td style='padding:8px 0'>{Esc(i.ProductName)}</td><td style='padding:8px 0'>x{i.Quantity}</td><td style='padding:8px 0;text-align:right'>{Money(i.UnitPrice * i.Quantity)}</td></tr>"));
        var html = $"""
        <div style='font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#171515'>
          <h2>AARPIVA payment successful</h2>
          <p>Hello {Esc(order.User.Name)},</p>
          <p>Your payment for order <strong>#{order.Id}</strong> has been verified successfully.</p>
          <table style='width:100%;border-collapse:collapse'>{lines}</table>
          <p style='border-top:1px solid #ddd;padding-top:12px'><strong>Total paid: {Money(order.TotalAmount)}</strong></p>
          <p>Your order status is now <strong>Confirmed</strong>.</p>
        </div>
        """;
        return SendSafeAsync(order.User.Email, $"AARPIVA order #{order.Id} payment confirmed", html);
    }

    public Task SendOrderStatusAsync(Order order)
    {
        var html = $"""
        <div style='font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#171515'>
          <h2>AARPIVA order update</h2>
          <p>Hello {Esc(order.User.Name)},</p>
          <p>Your order <strong>#{order.Id}</strong> is now <strong>{Esc(order.Status.ToString())}</strong>.</p>
          <p>Order total: <strong>{Money(order.TotalAmount)}</strong></p>
          <p>Open AARPIVA to view the latest tracking status and order details.</p>
        </div>
        """;
        return SendSafeAsync(order.User.Email, $"AARPIVA order #{order.Id} is {order.Status}", html);
    }

    public Task SendReturnRequestedAsync(ReturnRequest request)
    {
        var html = $"""
        <div style='font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#171515'>
          <h2>Return request received</h2>
          <p>Hello {Esc(request.User.Name)},</p>
          <p>We received your return request for order <strong>#{request.OrderId}</strong>.</p>
          <p><strong>Product:</strong> {Esc(request.OrderItem.ProductName)}<br/><strong>Quantity:</strong> {request.Quantity}<br/><strong>Reason:</strong> {Esc(request.Reason)}</p>
          <p>Status: <strong>Requested</strong></p>
        </div>
        """;
        return SendSafeAsync(request.User.Email, $"AARPIVA return request for order #{request.OrderId}", html);
    }

    public Task SendReturnStatusAsync(ReturnRequest request)
    {
        var html = $"""
        <div style='font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#171515'>
          <h2>AARPIVA return update</h2>
          <p>Hello {Esc(request.User.Name)},</p>
          <p>Your return request for order <strong>#{request.OrderId}</strong> and product <strong>{Esc(request.OrderItem.ProductName)}</strong> is now <strong>{Esc(request.Status.ToString())}</strong>.</p>
          {(string.IsNullOrWhiteSpace(request.AdminNote) ? "" : $"<p><strong>Store note:</strong> {Esc(request.AdminNote)}</p>")}
        </div>
        """;
        return SendSafeAsync(request.User.Email, $"AARPIVA return update for order #{request.OrderId}", html);
    }
}

public interface IRazorpayService
{
    Task<(string Id, long Amount)> CreateOrderAsync(long amountInPaise, string receipt);
    bool VerifySignature(string serverOrderId, string paymentId, string signature);
}

public class RazorpayService(IConfiguration cfg, IHttpClientFactory factory) : IRazorpayService
{
    private HttpClient Client => factory.CreateClient("razorpay");

    public async Task<(string Id, long Amount)> CreateOrderAsync(long amountInPaise, string receipt)
    {
        var key = cfg["Razorpay:KeyId"];
        var secret = cfg["Razorpay:KeySecret"];
        if (string.IsNullOrWhiteSpace(key) || string.IsNullOrWhiteSpace(secret))
            throw new InvalidOperationException("Razorpay credentials are not configured.");

        var req = new HttpRequestMessage(HttpMethod.Post, "/v1/orders");
        var auth = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{key}:{secret}"));
        req.Headers.Authorization = new AuthenticationHeaderValue("Basic", auth);
        req.Content = new StringContent(
            JsonSerializer.Serialize(new { amount = amountInPaise, currency = "INR", receipt, payment_capture = 1 }),
            Encoding.UTF8,
            "application/json");

        using var res = await Client.SendAsync(req);
        var body = await res.Content.ReadAsStringAsync();
        if (!res.IsSuccessStatusCode) throw new InvalidOperationException("Razorpay order creation failed.");

        using var doc = JsonDocument.Parse(body);
        return (doc.RootElement.GetProperty("id").GetString()!, doc.RootElement.GetProperty("amount").GetInt64());
    }

    public bool VerifySignature(string serverOrderId, string paymentId, string signature)
    {
        var secret = cfg["Razorpay:KeySecret"];
        if (string.IsNullOrWhiteSpace(secret)) return false;
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var digest = Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes($"{serverOrderId}|{paymentId}"))).ToLowerInvariant();
        return CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(digest), Encoding.UTF8.GetBytes(signature));
    }
}

public static class PasswordHasher
{
    private const int Iterations = 150_000;

    public static string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var key = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, 32);
        return $"{Iterations}.{Convert.ToBase64String(salt)}.{Convert.ToBase64String(key)}";
    }

    public static bool Verify(string password, string encoded)
    {
        try
        {
            var parts = encoded.Split('.', 3);
            if (parts.Length != 3 || !int.TryParse(parts[0], out var iterations) || iterations < 100_000) return false;
            var salt = Convert.FromBase64String(parts[1]);
            var expected = Convert.FromBase64String(parts[2]);
            var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, expected.Length);
            return CryptographicOperations.FixedTimeEquals(actual, expected);
        }
        catch
        {
            return false;
        }
    }
}
