# AARPIVA production deployment architecture

## Target stack

- Frontend: Cloudflare Pages
- API: Render Starter Docker service (or another always-on ASP.NET Core host)
- Database: Neon PostgreSQL
- Email: Brevo Transactional Email API over HTTPS
- Payments: Razorpay
- Images: keep the bundled demo/editorial images for now; real catalog images may later move to Cloudflare R2/custom domain

## Frontend

Cloudflare Pages settings:

- Root directory: `frontend/saree-store`
- Build command: `npm run build`
- Build output directory: `dist/saree-store/browser`

Set `src/environments/environment.production.ts` to the real HTTPS API URL, install dependencies with `npm ci`, then run `npm run build` from `frontend/saree-store`.

Angular copies `public/robots.txt` into the published `dist/saree-store/browser/` root. The dynamic sitemap is served by `functions/sitemap.xml.js` at `/sitemap.xml`; keep this Pages Function source at the project root, outside Angular's generated output. It fetches active catalog data from the public API.

There is no custom `404.html` or catch-all redirect. With the project deployed as a Cloudflare Pages SPA, its built-in fallback serves the root `index.html` for unmatched paths, so Angular deep links such as `/login`, `/products/12` and `/orders` continue to work. Static files in `dist/saree-store/browser/` are served normally.

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
