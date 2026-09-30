# AARPIVA production setup — step by step

This guide matches the current repository structure. Replace `yourdomain.com` with the domain you purchased.

## 1. Create the Git repository

From the AARPIVA project root:

```bash
git init
git add .
git status
git commit -m "Prepare AARPIVA for production"
git branch -M main
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/aarpiva.git
git push -u origin main
```

Before `git add .`, confirm `git status` does not show any `.env`, local settings, connection strings, Brevo keys, Razorpay secrets or JWT keys. The repository already contains root/frontend/backend `.gitignore` files.

## 2. Configure the production API

The backend is containerized with `backend/SareeStore.Api/Dockerfile` and `render.yaml`. The intended low-maintenance production target is an always-on Render service.

Set these environment variables in the API host:

```text
ASPNETCORE_ENVIRONMENT=Production
FrontendUrl=https://yourdomain.com;https://www.yourdomain.com
ConnectionStrings__DefaultConnection=<NEON_CONNECTION_STRING>
Jwt__Key=<LONG_RANDOM_SECRET>
Jwt__Issuer=SareeStore.Api
Jwt__Audience=SareeStore.Web
Jwt__ExpiryMinutes=120
Email__Mode=BrevoApi
Email__FromName=AARPIVA
Email__FromEmail=noreply@yourdomain.com
Brevo__ApiKey=<BREVO_API_KEY>
Razorpay__KeyId=<RAZORPAY_KEY_ID>
Razorpay__KeySecret=<RAZORPAY_KEY_SECRET>
Razorpay__ApiBaseUrl=https://api.razorpay.com/v1
```

Keep all secrets in the host secret manager/environment variables, not in GitHub.

The health endpoint is:

```text
/health
```

Use it as the deployment health check.

## 3. Give the API a custom domain

Create `api.yourdomain.com` in your DNS provider/Cloudflare and map it to the custom-domain target shown by your API host. Do not invent a CNAME value; copy the exact target shown by the host.

After the API host reports the custom domain is active, test:

```text
https://api.yourdomain.com/health
```

## 4. Configure the Angular production API URL

Edit:

```text
frontend/saree-store/src/environments/environment.production.ts
```

Set:

```ts
export const environment = {
  production: true,
  apiUrl: 'https://api.yourdomain.com/api'
};
```

The Angular production build uses this file replacement automatically.

## 5. Deploy Angular to Cloudflare Pages

Use the GitHub repository as the Pages source. Set the project root to:

```text
frontend/saree-store
```

Build command:

```text
npm ci && npm run build
```

Build output directory:

```text
dist/saree-store/browser
```

The repository already contains `public/_redirects` so Angular deep links such as `/login`, `/products/12` and `/orders` resolve to `index.html`.

Add the production domain as the Pages custom domain.

## 6. Brevo sender/domain authentication through Cloudflare DNS

Use Brevo as the source of truth for the DNS values. In Brevo, open the sender/domain authentication page and start the domain authentication flow for `yourdomain.com`. Brevo will display the exact DNS records to add.

In Cloudflare DNS:

1. Add each record Brevo gives you (commonly SPF, DKIM and a domain-verification record).
2. Keep the exact hostname and value shown by Brevo.
3. Do not create a second conflicting SPF record. Merge SPF mechanisms only when required instead of publishing multiple SPF TXT records.
4. Keep the required DKIM record type/name/value exactly as Brevo supplies it.
5. Wait for Brevo to verify the domain.

After verification, set `Email__FromEmail` to a sender address on the authenticated domain. The browser never receives the Brevo API key.

## 7. Razorpay setup

Development/staging:

1. Keep Razorpay in Test Mode.
2. Put the Test `KeyId` and `KeySecret` only in the API host secrets.
3. Leave the frontend code unchanged; the API returns the public `KeyId` during order creation.
4. Test successful payment, dismissal/cancel, failed payment and server-side signature verification.

Production:

1. Complete Razorpay account/KYC/business requirements required for your account.
2. Switch to Live Mode in the Razorpay dashboard.
3. Replace only the API host's `Razorpay__KeyId` and `Razorpay__KeySecret` values with the Live credentials.
4. Do not expose `Razorpay__KeySecret` to Angular.
5. Re-run the complete payment checklist in `docs/TESTING-CHECKLIST.md`.

## 8. Test the full production path

```text
https://yourdomain.com
        -> register
        -> Brevo OTP
        -> /verify-email
        -> login / JWT
        -> shop / cart
        -> address
        -> create order
        -> Razorpay checkout
        -> server-side payment verification
        -> /orders
        -> admin updates
        -> order/return email notifications
```

If any step returns a 401, 403, 429, 4xx or 5xx, inspect the browser Network response and the API host logs before changing frontend code.
