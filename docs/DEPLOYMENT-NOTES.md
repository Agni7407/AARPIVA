# AARPIVA production deployment architecture

## Target stack

- Frontend: Cloudflare Pages
- API: Render Starter Docker service (or another always-on ASP.NET Core host)
- Database: Neon PostgreSQL
- Email: Brevo Transactional Email API over HTTPS
- Payments: Razorpay
- Images: keep the bundled demo/editorial images for now; real catalog images may later move to Cloudflare R2/custom domain

## Frontend

1. Set `src/environments/environment.production.ts` to the real HTTPS API URL.
2. `npm ci`
3. `npm run build`
4. Publish `dist/saree-store`.
5. Configure the custom domain in Cloudflare Pages.
6. The included `public/_redirects` keeps Angular deep links working.

## API

The repository includes `render.yaml` and `backend/SareeStore.Api/Dockerfile`. Put all secrets in the hosting provider's environment/secret store.

Required environment variables:

- `ConnectionStrings__DefaultConnection`
- `Jwt__Key`
- `Jwt__Issuer`
- `Jwt__Audience`
- `Jwt__ExpiryMinutes`
- `FrontendUrl`
- `Email__Mode=BrevoApi`
- `Email__FromName`
- `Email__FromEmail`
- `Brevo__ApiKey`
- `Razorpay__KeyId`
- `Razorpay__KeySecret`
- `Razorpay__ApiBaseUrl=https://api.razorpay.com/v1`

Health endpoint: `/health`

Swagger is enabled only in Development.

## Security

- Never commit the Neon connection string, Brevo API key, Brevo SMTP key, Razorpay secret, or JWT signing key.
- The public catalog endpoints only expose active products/categories. Admin-only catalog endpoints require the Admin policy.
- Login, registration, OTP verification and resend are rate limited.
- Use HTTPS at the hosting/proxy layer.
- Configure CORS to the exact frontend origins.

## Cloudflare + Brevo DNS

Brevo sender/domain authentication is configured at the DNS provider for the domain. When Cloudflare is the authoritative DNS provider, copy the exact SPF/DKIM/verification records supplied by Brevo into Cloudflare DNS. Do not invent record names or values; Brevo's dashboard is the source of truth.

## V1 limitations to address before scaling

- Add a controlled EF Core migration pipeline before frequent production schema changes.
- Add Razorpay webhook reconciliation so a successful payment is not lost when the browser callback is interrupted.
- For higher order volume, introduce a deliberate stock reservation/rollback strategy so concurrent unpaid orders cannot oversell inventory.
