# AARPIVA production-readiness test checklist

## Frontend state/change detection
- [ ] Register -> UI moves to `/verify-email?email=...`
- [ ] OTP success -> UI redirects to `/login?verified=1`
- [ ] Failed login displays the backend error and offers `Verify this email address` when appropriate
- [ ] 400/404/500 errors do not leave a button permanently disabled
- [ ] Product, cart, checkout, orders and admin data refresh after API responses

## Catalog
- [ ] Only active database products/categories are public
- [ ] `/api/products/admin` requires Admin
- [ ] `/api/categories/admin` requires Admin
- [ ] No dummy/demo product appears in home/shop/cart/product detail
- [ ] Existing demo images remain available as visual assets

## Auth
- [ ] Register
- [ ] Receive Brevo OTP
- [ ] Verify OTP
- [ ] Login and receive JWT
- [ ] JWT is attached to protected API calls
- [ ] Expired/invalid JWT redirects to login

## Checkout / payments
- [ ] Address CRUD
- [ ] Server recalculates product prices and shipping
- [ ] Razorpay test payment
- [ ] Server verifies payment signature
- [ ] Paid order status becomes Confirmed
- [ ] Stock decrements only after successful payment verification

## Admin
- [ ] Dashboard loads only the active tab
- [ ] Product/category/customer/order/return tabs load on demand
- [ ] Product/category mutation requires Admin
- [ ] Order/return status updates persist

## Deployment
- [ ] No secrets in Git history
- [ ] Cloudflare Pages uses the production API URL
- [ ] API CORS lists only the real website origins
- [ ] `/health` returns 200
- [ ] Production Swagger is not publicly exposed
- [ ] Brevo sender/domain is authenticated
- [ ] Razorpay live credentials are stored only as host secrets
