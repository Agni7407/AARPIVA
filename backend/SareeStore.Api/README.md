# AARPIVA V1 Backend

ASP.NET Core 10 Web API + EF Core + PostgreSQL. Designed for Neon PostgreSQL and a low-cost production deployment.

## Local development
1. Install the .NET 10 SDK.
2. Set `ConnectionStrings:DefaultConnection` to your PostgreSQL/Neon connection string using an environment variable or an ignored local settings file.
3. From this folder: `dotnet restore` then `dotnet run`.
4. Swagger: `http://localhost:5107/swagger` while running in Development.
5. The V1 bootstrap currently uses `EnsureCreatedAsync()` plus idempotent SQL for the OTP and return-request tables. Before making frequent schema changes in production, add and deploy EF Core migrations deliberately; do not rely on application startup to evolve an existing production schema.

## Admin seeding
No admin account is seeded by default. For a controlled environment bootstrap, provide `SeedAdmin__Email` and `SeedAdmin__Password` as host secrets before the first start. Do not commit admin credentials.

## Email + OTP verification
Production uses Brevo Transactional Email API over HTTPS (`Email:Mode=BrevoApi`). Set `Email__FromEmail` to a verified Brevo sender and set `Brevo__ApiKey`. Registration sends a 6-digit OTP that expires after 10 minutes; OTPs are hashed in the database, limited to 5 attempts, and have a 60-second resend cooldown.

## Razorpay
The backend creates Razorpay orders with the secret key, returns only the public `KeyId` to the browser, and verifies the payment callback with the server-side HMAC SHA-256 signature before marking an order paid. Use Test Mode keys until your production checkout has been verified.

## Security
Do not commit production secrets. HTTPS is required for the deployed frontend/API. CORS is restricted to the configured frontend origins, admin catalog mutations require the Admin policy, and auth/OTP endpoints are rate limited. The `/health` endpoint is anonymous and Swagger is disabled outside Development.
