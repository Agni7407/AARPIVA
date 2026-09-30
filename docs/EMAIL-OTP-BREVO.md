# AARPIVA Email + OTP with Brevo API

The production configuration uses Brevo's HTTPS transactional-email API instead of SMTP. This avoids outbound SMTP restrictions on some low-cost hosts. SMTP support remains in the code for local/legacy use, but production should use `BrevoApi`.

## Brevo setup

1. Verify the AARPIVA sender email or authenticate the sending domain in Brevo.
2. Create a Brevo API key with permission to send transactional email.
3. Set the following environment variables: 

```text
Email__Mode=BrevoApi
Email__FromName=AARPIVA
Email__FromEmail=noreply@yourdomain.com
Brevo__ApiKey=YOUR_BREVO_API_KEY
```

4. If using Cloudflare as DNS, add the exact domain-authentication records Brevo provides (typically SPF/DKIM/verification records). Use the exact host/value/TTL shown in Brevo.

## OTP flow

`Register -> create 6-digit OTP -> store SHA-256 hash -> Brevo API email -> verify OTP -> mark IsEmailVerified=true -> redirect to login`.

Rules:

- 6 digits
- 10 minute expiry
- one-time use
- max 5 attempts per code
- 60 second resend cooldown
- auth endpoints rate limited

## Important

Never put the Brevo API key into Angular. Never commit it to GitHub.
