# AARPIVA Cloudflare R2 Admin Uploads

## Production environment variables (Render)

- `CloudflareR2__AccessKey` = Cloudflare R2 Access Key ID
- `CloudflareR2__SecretKey` = Cloudflare R2 Secret Access Key
- `CloudflareR2__Bucket` = `aarpiva-products`
- `CloudflareR2__Endpoint` = `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
- `CloudflareR2__PublicBaseUrl` = `https://images.aarpiva.com`

Never put the Access Key or Secret Key in Angular or GitHub.

## Admin upload flow

1. Angular admin requests a short-lived upload URL from `POST /api/admin/media/upload-url`.
2. ASP.NET validates the Admin JWT, MIME type, and requested size.
3. ASP.NET creates a presigned R2 PUT URL.
4. The browser uploads directly to R2 using the signed URL and the exact `Content-Type`.
5. Angular calls `POST /api/admin/media/complete`.
6. The backend checks the stored object metadata and returns the public `https://images.aarpiva.com/...` URL.
7. The product save stores the resulting image URL in Neon.

## R2 CORS

Allow:

- `https://aarpiva.com`
- `https://www.aarpiva.com`
- `http://localhost:4200` (remove after local testing if desired)

Method:

- `PUT`

Header:

- `Content-Type`

## Supported images

JPEG, PNG, WEBP and AVIF, up to 10 MB per image.
