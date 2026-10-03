using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using SareeStore.Api.Data;
using SareeStore.Api.DTOs;
using SareeStore.Api.Models;
using SareeStore.Api.Services;

namespace SareeStore.Api.Controllers;

[ApiController, Route("api/auth")]
public class AuthController(
    AppDbContext db,
    IConfiguration cfg,
    IEmailSender email,
    ILogger<AuthController> logger) : ControllerBase
{
    private const string TermsVersion = "2026-10-03";

    [EnableRateLimiting("auth")]
    [HttpPost("register")]
    public async Task<ActionResult> Register(RegisterRequest req)
    {
        if (!req.AcceptTerms)
            return BadRequest("Please accept the Terms & Conditions and Privacy Policy to create an account.");

        var normalized = req.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(x => x.Email == normalized))
            return Conflict("Email already registered.");

        var user = new AppUser
        {
            Name = req.Name.Trim(),
            Email = normalized,
            PasswordHash = PasswordHasher.Hash(req.Password),
            IsEmailVerified = false,
            TermsAcceptedAt = DateTime.UtcNow,
            TermsVersion = TermsVersion
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();

        await CreateAndSendOtp(user);
        return Ok(new { message = "Registration successful. A 6-digit verification code has been sent to your email.", email = user.Email });
    }

    [EnableRateLimiting("auth")]
    [HttpPost("verify-otp")]
    public async Task<ActionResult> VerifyOtp(VerifyOtpRequest req)
    {
        var normalized = req.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(x => x.Email == normalized);
        if (user is null || user.IsEmailVerified) return BadRequest("Invalid verification code.");

        var item = await db.EmailVerificationOtps
            .Where(x => x.UserId == user.Id && !x.Used && x.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync();

        if (item is null) return BadRequest("This verification code has expired. Request a new code.");

        item.Attempts++;
        if (item.Attempts > 5)
        {
            item.Used = true;
            await db.SaveChangesAsync();
            return BadRequest("Too many incorrect attempts. Request a new code.");
        }

        var suppliedHash = OtpService.Hash(req.Otp.Trim());
        if (!CryptographicOperations.FixedTimeEquals(
                System.Text.Encoding.UTF8.GetBytes(item.OtpHash),
                System.Text.Encoding.UTF8.GetBytes(suppliedHash)))
        {
            await db.SaveChangesAsync();
            return BadRequest("Invalid verification code.");
        }

        item.Used = true;
        user.IsEmailVerified = true;
        await db.SaveChangesAsync();
        return Ok(new { message = "Email verified successfully." });
    }

    [EnableRateLimiting("auth")]
    [HttpPost("resend-otp")]
    public async Task<ActionResult> ResendOtp(ResendOtpRequest req)
    {
        var normalized = req.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(x => x.Email == normalized);
        if (user is null || user.IsEmailVerified)
            return Ok(new { message = "If the account exists and needs verification, a new code has been sent." });

        var latest = await db.EmailVerificationOtps
            .Where(x => x.UserId == user.Id)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync();

        if (latest is not null && latest.CreatedAt > DateTime.UtcNow.AddSeconds(-60))
            return BadRequest("Please wait 60 seconds before requesting another code.");

        await CreateAndSendOtp(user);
        return Ok(new { message = "A new verification code has been sent." });
    }

    [EnableRateLimiting("auth")]
    [HttpPost("forgot-password")]
    public async Task<ActionResult> ForgotPassword(ForgotPasswordRequest req)
    {
        var normalized = req.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(x => x.Email == normalized);

        if (user is not null)
        {
            await TryCreateAndSendPasswordResetOtp(user);
        }

        return Ok(new
        {
            message = "If an account exists for this email, a password reset code has been sent."
        });
    }

    [EnableRateLimiting("auth")]
    [HttpPost("resend-password-reset-otp")]
    public async Task<ActionResult> ResendPasswordResetOtp(ResendPasswordResetOtpRequest req)
    {
        var normalized = req.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(x => x.Email == normalized);

        if (user is null)
        {
            return Ok(new { message = "If an account exists for this email, a new password reset code has been sent." });
        }

        var latest = await db.PasswordResetOtps
            .Where(x => x.UserId == user.Id)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync();

        if (latest is not null && latest.CreatedAt > DateTime.UtcNow.AddSeconds(-60))
            return BadRequest("Please wait 60 seconds before requesting another code.");

        await TryCreateAndSendPasswordResetOtp(user);
        return Ok(new { message = "If an account exists for this email, a new password reset code has been sent." });
    }

    [EnableRateLimiting("auth")]
    [HttpPost("reset-password")]
    public async Task<ActionResult> ResetPassword(ResetPasswordRequest req)
    {
        var normalized = req.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(x => x.Email == normalized);
        if (user is null) return BadRequest("Invalid or expired reset code.");

        var item = await db.PasswordResetOtps
            .Where(x => x.UserId == user.Id && !x.Used && x.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync();

        if (item is null) return BadRequest("This reset code has expired. Request a new code.");

        item.Attempts++;
        if (item.Attempts > 5)
        {
            item.Used = true;
            await db.SaveChangesAsync();
            return BadRequest("Too many incorrect attempts. Request a new code.");
        }

        var suppliedHash = OtpService.Hash(req.Otp.Trim());
        if (!CryptographicOperations.FixedTimeEquals(
                System.Text.Encoding.UTF8.GetBytes(item.OtpHash),
                System.Text.Encoding.UTF8.GetBytes(suppliedHash)))
        {
            await db.SaveChangesAsync();
            return BadRequest("Invalid reset code.");
        }

        var activeResetCodes = await db.PasswordResetOtps
            .Where(x => x.UserId == user.Id && !x.Used)
            .ToListAsync();
        foreach (var code in activeResetCodes) code.Used = true;

        user.PasswordHash = PasswordHasher.Hash(req.NewPassword);
        user.IsEmailVerified = true;
        await db.SaveChangesAsync();

        try
        {
            await email.SendAsync(
                user.Email,
                "Your AARPIVA password was changed",
                BuildPasswordChangedEmail(user.Name));
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Password reset succeeded but notification email failed for {Email}", user.Email);
        }

        return Ok(new { message = "Your password has been reset successfully. You can now log in with your new password." });
    }

    [Authorize]
    [HttpPost("change-password")]
    public async Task<ActionResult> ChangePassword(ChangePasswordRequest req)
    {
        var userId = ApiHelper.UserId(User);
        var user = await db.Users.FirstOrDefaultAsync(x => x.Id == userId);
        if (user is null) return Unauthorized("Your session is no longer valid.");

        if (!PasswordHasher.Verify(req.CurrentPassword, user.PasswordHash))
            return BadRequest("Your current password is incorrect.");

        if (PasswordHasher.Verify(req.NewPassword, user.PasswordHash))
            return BadRequest("Your new password must be different from your current password.");

        user.PasswordHash = PasswordHasher.Hash(req.NewPassword);
        await db.SaveChangesAsync();

        try
        {
            await email.SendAsync(
                user.Email,
                "Your AARPIVA password was changed",
                BuildPasswordChangedEmail(user.Name));
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Password changed but notification email failed for {Email}", user.Email);
        }

        return Ok(new { message = "Password changed successfully." });
    }

    // Backward-compatible link verification for older accounts/emails.
    [HttpPost("verify-email")]
    public async Task<ActionResult> VerifyLegacy(VerifyEmailRequest req)
    {
        var hash = ApiHelper.Sha256(req.Token);
        var item = await db.EmailVerificationTokens.Include(x => x.User)
            .FirstOrDefaultAsync(x => x.TokenHash == hash && !x.Used && x.ExpiresAt > DateTime.UtcNow);
        if (item is null) return BadRequest("Invalid or expired verification token.");
        item.Used = true;
        item.User.IsEmailVerified = true;
        await db.SaveChangesAsync();
        return Ok(new { message = "Email verified successfully." });
    }

    [HttpPost("resend-verification")]
    public async Task<ActionResult> ResendLegacy(ResendVerificationRequest req)
    {
        var normalized = req.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(x => x.Email == normalized);
        if (user is null || user.IsEmailVerified) return Ok(new { message = "If the account exists and needs verification, a new code has been sent." });
        return await ResendOtp(new ResendOtpRequest(normalized));
    }

    [EnableRateLimiting("auth")]
    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest req)
    {
        var user = await db.Users.FirstOrDefaultAsync(x => x.Email == req.Email.Trim().ToLowerInvariant());
        if (user is null || !PasswordHasher.Verify(req.Password, user.PasswordHash)) return Unauthorized("Invalid email or password.");
        if (!user.IsEmailVerified && user.Role != UserRole.Admin) return BadRequest("Please verify your email before logging in.");
        return Ok(new AuthResponse(ApiHelper.CreateJwt(cfg, user.Id, user.Name, user.Email, user.Role.ToString()), user.Id, user.Name, user.Email, user.Role.ToString(), user.IsEmailVerified));
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult> Me() => Ok(await db.Users.Where(x => x.Id == ApiHelper.UserId(User)).Select(x => new { x.Id, x.Name, x.Email, Role = x.Role.ToString(), x.IsEmailVerified }).FirstAsync());

    private async Task CreateAndSendOtp(AppUser user)
    {
        var active = await db.EmailVerificationOtps.Where(x => x.UserId == user.Id && !x.Used).ToListAsync();
        foreach (var item in active) item.Used = true;

        var otp = OtpService.Generate();
        db.EmailVerificationOtps.Add(new EmailVerificationOtp
        {
            UserId = user.Id,
            OtpHash = OtpService.Hash(otp),
            ExpiresAt = DateTime.UtcNow.AddMinutes(10)
        });
        await db.SaveChangesAsync();

        var html = $"""
        <div style='font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#171515'>
          <div style='padding:28px;background:#f7f4ef'><div style='font-size:24px;font-weight:800;letter-spacing:.12em'>AARPIVA</div></div>
          <div style='padding:28px;background:#fff'>
            <h2>Your verification code</h2>
            <p>Hello {System.Net.WebUtility.HtmlEncode(user.Name)},</p>
            <p>Use the 6-digit code below to verify your AARPIVA account:</p>
            <div style='font-size:34px;font-weight:800;letter-spacing:10px;margin:24px 0'>{otp}</div>
            <p>This code expires in <strong>10 minutes</strong> and can be used only once.</p>
            <p>If you did not create an AARPIVA account, you can ignore this email.</p>
          </div>
        </div>
        """;

        try
        {
            await email.SendAsync(user.Email, "Your AARPIVA verification code", html);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unable to send verification OTP to {Email}", user.Email);
            throw new InvalidOperationException("Your account was created, but the verification email could not be sent. Please configure Brevo and use Resend OTP.", ex);
        }
    }

    private async Task TryCreateAndSendPasswordResetOtp(AppUser user)
    {
        try
        {
            var active = await db.PasswordResetOtps.Where(x => x.UserId == user.Id && !x.Used).ToListAsync();
            foreach (var item in active) item.Used = true;

            var otp = OtpService.Generate();
            db.PasswordResetOtps.Add(new PasswordResetOtp
            {
                UserId = user.Id,
                OtpHash = OtpService.Hash(otp),
                ExpiresAt = DateTime.UtcNow.AddMinutes(10)
            });
            await db.SaveChangesAsync();

            var html = $"""
            <div style='font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#171515'>
              <div style='padding:28px;background:#f7f4ef'><div style='font-size:24px;font-weight:800;letter-spacing:.12em'>AARPIVA</div></div>
              <div style='padding:28px;background:#fff'>
                <h2>Password reset code</h2>
                <p>Hello {System.Net.WebUtility.HtmlEncode(user.Name)},</p>
                <p>Use the 6-digit code below to reset your AARPIVA password:</p>
                <div style='font-size:34px;font-weight:800;letter-spacing:10px;margin:24px 0'>{otp}</div>
                <p>This code expires in <strong>10 minutes</strong> and can be used only once.</p>
                <p>If you did not request a password reset, you can safely ignore this email.</p>
              </div>
            </div>
            """;

            await email.SendAsync(user.Email, "Your AARPIVA password reset code", html);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unable to send password reset OTP to {Email}", user.Email);
        }
    }

    private static string BuildPasswordChangedEmail(string name) => $"""
        <div style='font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#171515'>
          <div style='padding:28px;background:#f7f4ef'><div style='font-size:24px;font-weight:800;letter-spacing:.12em'>AARPIVA</div></div>
          <div style='padding:28px;background:#fff'>
            <h2>Your password was changed</h2>
            <p>Hello {System.Net.WebUtility.HtmlEncode(name)},</p>
            <p>Your AARPIVA account password was changed successfully.</p>
            <p>If you did not make this change, contact AARPIVA support immediately at <a href='mailto:aarpiva1801@gmail.com'>aarpiva1801@gmail.com</a>.</p>
          </div>
        </div>
        """;
}
