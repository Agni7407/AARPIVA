# Secure configuration

The repository intentionally contains no production credentials.

Use the hosting provider's secret/environment-variable store for:

- `ConnectionStrings__DefaultConnection`
- `Jwt__Key`
- `Brevo__ApiKey`
- `Razorpay__KeyId`
- `Razorpay__KeySecret`
- `Email__FromEmail`
- Cloudflare R2 credentials when direct uploads are implemented
- Optional `SeedAdmin__Email` / `SeedAdmin__Password` only when intentionally seeding a new environment

## Rotate previously exposed credentials

The development archive that was previously shared contained live-looking database and Brevo credentials. Those credentials should be treated as compromised and rotated before GitHub/public deployment.
