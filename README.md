# AARPIVA / SareeStore

Full-stack Indian fashion e-commerce store:

- Angular 21 storefront
- ASP.NET Core 10 Web API
- Neon PostgreSQL
- JWT auth + Admin policy
- 6-digit email OTP verification
- Brevo transactional email API
- Razorpay payments with server-side signature verification
- Customer addresses, orders, tracking and returns
- Admin catalog/order/customer/return management

## Local development

Frontend:

```bash
cd frontend/saree-store
npm ci
npm start
```

Backend:

```bash
cd backend/SareeStore.Api
dotnet run
```

The local development config defaults to a local PostgreSQL connection and console email. Put personal development secrets in local environment variables or an ignored `appsettings.Local.json`.

## Production architecture

Cloudflare Pages (Angular) -> HTTPS -> ASP.NET Core API -> Neon PostgreSQL

API integrations:

- Brevo HTTPS API for OTP and transactional notifications
- Razorpay API for order creation + signature verification

See `docs/PRODUCTION-SETUP-STEP-BY-STEP.md`, `docs/DEPLOYMENT-NOTES.md`, `docs/EMAIL-OTP-BREVO.md` and `docs/SECURE-CONFIGURATION.md`.

## Demo/editorial images

The existing files under `frontend/saree-store/src/assets/demo/` are retained as visual/editorial assets and as safe image fallbacks. **There are no longer any dummy/demo products in the storefront, routes, cart or order flow.**

## Git / CI

A root `.gitignore`, GitHub Actions CI workflow and Render Docker deployment manifest are included.

## Production-readiness notes

The current V1 is prepared for deployment with environment-based secrets, Angular production configuration, Cloudflare Pages SPA fallback, Render Docker deployment, Brevo HTTPS email, Razorpay server-side signature verification, auth rate limiting and admin-only catalog APIs. See `docs/TESTING-CHECKLIST.md` for the remaining live-environment tests.

Two deliberate V1 limitations remain documented rather than being hidden: the current database bootstrap uses `EnsureCreatedAsync()` (add controlled EF Core migrations before ongoing schema evolution), and Razorpay reconciliation currently depends on the client callback (add Razorpay webhooks before treating a high-volume store as fully payment-reconciled).


## Payment lifecycle
See `docs/CHANGES-PAYMENT-FLOW.md` for the server-side cart + Razorpay payment draft lifecycle and cancellation behavior.


## Account security and legal pages

The production frontend includes Brevo OTP password reset, authenticated password change, Terms & Conditions / Privacy Policy pages, and the AARPIVA contact page. See `docs/ACCOUNT-SECURITY-AND-LEGAL-PAGES.md`.
