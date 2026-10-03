using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SareeStore.Api.Services;

namespace SareeStore.Api.Controllers;

[ApiController]
[Authorize(Policy = "Admin")]
[Route("api/admin/media")]
public sealed class MediaController(IR2StorageService storage, ILogger<MediaController> logger) : ControllerBase
{
    private static readonly HashSet<string> AllowedTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/avif"
    };

    [HttpPost("upload-url")]
    public ActionResult<R2UploadTicket> CreateUploadUrl(CreateUploadUrlRequest request)
    {
        try
        {
            if (request.SizeBytes is < 1 or > 10 * 1024 * 1024)
                return BadRequest(new { message = "Image must be between 1 byte and 10 MB." });

            if (!AllowedTypes.Contains(request.ContentType?.Trim() ?? string.Empty))
                return BadRequest(new { message = "Only JPEG, PNG, WEBP and AVIF images are supported." });

            return Ok(storage.CreateUploadTicket(request.ContentType.Trim()));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unable to create R2 upload URL.");
            return Problem(title: "Image upload is not configured correctly.", statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }

    [HttpPost("complete")]
    public async Task<ActionResult<R2UploadFinalizeResult>> Complete(CompleteUploadRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await storage.FinalizeUploadAsync(
                request.ObjectKey,
                request.ContentType,
                request.SizeBytes,
                cancellationToken);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unable to finalize R2 upload {ObjectKey}.", request.ObjectKey);
            return Problem(title: "Could not finalize image upload.", statusCode: StatusCodes.Status500InternalServerError);
        }
    }

    [HttpDelete]
    public async Task<IActionResult> Delete(DeleteUploadRequest request, CancellationToken cancellationToken)
    {
        try
        {
            await storage.DeleteObjectAsync(request.ObjectKey, cancellationToken);
            return NoContent();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unable to delete R2 object {ObjectKey}.", request.ObjectKey);
            return Problem(title: "Could not delete image.", statusCode: StatusCodes.Status500InternalServerError);
        }
    }

    public sealed class CreateUploadUrlRequest
    {
        [Required]
        public string ContentType { get; init; } = string.Empty;

        public long SizeBytes { get; init; }
    }

    public sealed class CompleteUploadRequest
    {
        [Required]
        public string ObjectKey { get; init; } = string.Empty;

        [Required]
        public string ContentType { get; init; } = string.Empty;

        public long SizeBytes { get; init; }
    }

    public sealed class DeleteUploadRequest
    {
        [Required]
        public string ObjectKey { get; init; } = string.Empty;
    }
}
