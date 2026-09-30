using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace SareeStore.Api.Controllers;
public static class ApiHelper
{
    public static int UserId(ClaimsPrincipal user) => int.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
    public static string Slug(string value)
    {
        var s = new string(value.Trim().ToLowerInvariant().Select(c => char.IsLetterOrDigit(c) ? c : '-').ToArray());
        while (s.Contains("--")) s = s.Replace("--", "-");
        return s.Trim('-');
    }
    public static string RandomToken() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    public static string Sha256(string text) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text))).ToLowerInvariant();
    public static string CreateJwt(IConfiguration cfg, int userId, string name, string email, string role)
    {
        var claims = new[] { new Claim(ClaimTypes.NameIdentifier, userId.ToString()), new Claim(ClaimTypes.Name, name), new Claim(ClaimTypes.Email, email), new Claim(ClaimTypes.Role, role) };
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(cfg["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var minutes = double.TryParse(cfg["Jwt:ExpiryMinutes"], out var m) ? m : 120;
        var token = new JwtSecurityToken(cfg["Jwt:Issuer"], cfg["Jwt:Audience"], claims, expires: DateTime.UtcNow.AddMinutes(minutes), signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
