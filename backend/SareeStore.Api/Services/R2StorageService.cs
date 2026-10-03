using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using System.Security.Cryptography;

namespace SareeStore.Api.Services;

public sealed record R2UploadTicket(
    string UploadUrl,
    string ObjectKey,
    string PublicUrl,
    int ExpiresInSeconds);

public sealed record R2UploadFinalizeResult(
    string ObjectKey,
    string PublicUrl,
    string ContentType,
    long SizeBytes);

public interface IR2StorageService
{
    R2UploadTicket CreateUploadTicket(string contentType);
    Task<R2UploadFinalizeResult> FinalizeUploadAsync(string objectKey, string expectedContentType, long expectedSizeBytes, CancellationToken cancellationToken = default);
    Task DeleteObjectAsync(string objectKey, CancellationToken cancellationToken = default);
}

public sealed class R2StorageService(IConfiguration configuration, ILogger<R2StorageService> logger) : IR2StorageService, IDisposable
{
    private const long MaxImageBytes = 10 * 1024 * 1024;
    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/avif"
    };

    private readonly IConfiguration configuration = configuration;
    private readonly ILogger<R2StorageService> logger = logger;
    private IAmazonS3? client;

    public R2UploadTicket CreateUploadTicket(string contentType)
    {
        ValidateContentType(contentType);
        var (s3, bucket, publicBaseUrl) = GetConfiguredClient();
        var objectKey = $"products/{DateTime.UtcNow:yyyy/MM}/{Guid.NewGuid():N}";
        var request = new GetPreSignedUrlRequest
        {
            BucketName = bucket,
            Key = objectKey,
            Verb = HttpVerb.PUT,
            ContentType = contentType,
            Expires = DateTime.UtcNow.AddMinutes(15)
        };

        AWSConfigsS3.UseSignatureVersion4 = true;
        var uploadUrl = s3.GetPreSignedURL(request);
        var publicUrl = BuildPublicUrl(publicBaseUrl, objectKey);
        return new R2UploadTicket(uploadUrl, objectKey, publicUrl, 900);
    }

    public async Task<R2UploadFinalizeResult> FinalizeUploadAsync(
        string objectKey,
        string expectedContentType,
        long expectedSizeBytes,
        CancellationToken cancellationToken = default)
    {
        ValidateContentType(expectedContentType);
        if (expectedSizeBytes is < 1 or > MaxImageBytes)
            throw new InvalidOperationException("Image must be larger than 0 bytes and no larger than 10 MB.");
        if (!objectKey.StartsWith("products/", StringComparison.Ordinal))
            throw new InvalidOperationException("Invalid product image key.");

        var (s3, bucket, publicBaseUrl) = GetConfiguredClient();

        try
        {
            var metadata = await s3.GetObjectMetadataAsync(new GetObjectMetadataRequest
            {
                BucketName = bucket,
                Key = objectKey
            }, cancellationToken);

            var actualType = metadata.Headers.ContentType?.Trim() ?? string.Empty;
            var actualSize = metadata.ContentLength;
            if (!AllowedContentTypes.Contains(actualType) || !string.Equals(actualType, expectedContentType, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("The uploaded file type is not allowed.");
            if (actualSize < 1 || actualSize > MaxImageBytes)
                throw new InvalidOperationException("The uploaded file exceeds the 10 MB image limit.");
            if (expectedSizeBytes != actualSize)
                throw new InvalidOperationException("The uploaded image size did not match the requested upload.");

            return new R2UploadFinalizeResult(objectKey, BuildPublicUrl(publicBaseUrl, objectKey), actualType, actualSize);
        }
        catch
        {
            try
            {
                await s3.DeleteObjectAsync(new DeleteObjectRequest { BucketName = bucket, Key = objectKey }, cancellationToken);
            }
            catch (Exception cleanupEx)
            {
                logger.LogWarning(cleanupEx, "Unable to remove invalid R2 upload {ObjectKey}", objectKey);
            }
            throw;
        }
    }

    public async Task DeleteObjectAsync(string objectKey, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(objectKey) || !objectKey.StartsWith("products/", StringComparison.Ordinal))
            return;

        var (s3, bucket, _) = GetConfiguredClient();
        await s3.DeleteObjectAsync(new DeleteObjectRequest
        {
            BucketName = bucket,
            Key = objectKey
        }, cancellationToken);
    }

    private (IAmazonS3 Client, string Bucket, string PublicBaseUrl) GetConfiguredClient()
    {
        var accessKey = configuration["CloudflareR2:AccessKey"];
        var secretKey = configuration["CloudflareR2:SecretKey"];
        var bucket = configuration["CloudflareR2:Bucket"];
        var endpoint = configuration["CloudflareR2:Endpoint"];
        var publicBaseUrl = configuration["CloudflareR2:PublicBaseUrl"];

        if (string.IsNullOrWhiteSpace(accessKey) ||
            string.IsNullOrWhiteSpace(secretKey) ||
            string.IsNullOrWhiteSpace(bucket) ||
            string.IsNullOrWhiteSpace(endpoint) ||
            string.IsNullOrWhiteSpace(publicBaseUrl))
        {
            throw new InvalidOperationException("Cloudflare R2 is not configured. Set CloudflareR2:AccessKey, SecretKey, Bucket, Endpoint and PublicBaseUrl.");
        }

        if (!Uri.TryCreate(endpoint, UriKind.Absolute, out var endpointUri) || endpointUri.Scheme != Uri.UriSchemeHttps)
            throw new InvalidOperationException("CloudflareR2:Endpoint must be a valid HTTPS URL.");
        if (!Uri.TryCreate(publicBaseUrl, UriKind.Absolute, out var publicUri) || publicUri.Scheme != Uri.UriSchemeHttps)
            throw new InvalidOperationException("CloudflareR2:PublicBaseUrl must be a valid HTTPS URL.");

        client ??= new AmazonS3Client(
            new BasicAWSCredentials(accessKey, secretKey),
            new AmazonS3Config
            {
                ServiceURL = endpointUri.ToString().TrimEnd('/'),
                ForcePathStyle = true
            });

        return (client, bucket, publicUri.ToString().TrimEnd('/'));
    }

    private static void ValidateContentType(string contentType)
    {
        if (string.IsNullOrWhiteSpace(contentType) || !AllowedContentTypes.Contains(contentType.Trim()))
            throw new InvalidOperationException("Only JPEG, PNG, WEBP and AVIF images are supported.");
    }

    private static string BuildPublicUrl(string publicBaseUrl, string objectKey)
        => $"{publicBaseUrl.TrimEnd('/')}/{objectKey}"
            .Replace(" ", "%20", StringComparison.Ordinal);

    public void Dispose()
    {
        client?.Dispose();
    }
}
