using System.Text.RegularExpressions;

namespace SareeStore.Api.Services;

public static class R2ObjectKeyMapper
{
    private static readonly Regex OwnedKey = new("^products/[0-9]{4}/(0[1-9]|1[0-2])/[a-f0-9]{32}$", RegexOptions.CultureInvariant | RegexOptions.Compiled);

    public static string BuildPublicUrl(string publicBaseUrl, string bucket, string objectKey)
    {
        var encodedKey = string.Join("/", objectKey.Split('/', StringSplitOptions.RemoveEmptyEntries).Select(Uri.EscapeDataString));
        return $"{publicBaseUrl.TrimEnd('/')}/{Uri.EscapeDataString(bucket)}/{encodedKey}";
    }

    public static bool TryGetOwnedObjectKey(string publicUrl, string publicBaseUrl, string bucket, out string objectKey)
    {
        objectKey = string.Empty;
        if (!Uri.TryCreate(publicUrl, UriKind.Absolute, out var url) || !Uri.TryCreate(publicBaseUrl, UriKind.Absolute, out var baseUri)) return false;
        var prefix = $"{baseUri.AbsolutePath.TrimEnd('/')}/{Uri.EscapeDataString(bucket)}/";
        if (url.Scheme != Uri.UriSchemeHttps || !url.Authority.Equals(baseUri.Authority, StringComparison.OrdinalIgnoreCase) || !url.AbsolutePath.StartsWith(prefix, StringComparison.Ordinal)) return false;
        try { objectKey = string.Join("/", url.AbsolutePath[prefix.Length..].Split('/').Select(Uri.UnescapeDataString)); }
        catch { objectKey = string.Empty; return false; }
        return OwnedKey.IsMatch(objectKey);
    }

    public static bool IsOwnedKey(string objectKey) => OwnedKey.IsMatch(objectKey ?? string.Empty);
}

public static class ImageReferencePolicy
{
    public static bool IsReferenced(string objectKey, IEnumerable<string?> imageUrls, Func<string, bool> mapsToKey) =>
        imageUrls.Where(url => !string.IsNullOrWhiteSpace(url)).Any(url => mapsToKey(url!));
}
