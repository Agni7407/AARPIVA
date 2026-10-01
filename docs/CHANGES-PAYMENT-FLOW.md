# AARPIVA payment flow hardening

## What changed

A checkout attempt still creates an `Order` record as a server-side payment draft so that the Razorpay order can be associated with a stable amount and order id. The draft remains `PaymentStatus=Pending` and `Status=Pending` until Razorpay payment verification succeeds.

Customers now see only paid/refunded orders from `GET /api/orders/mine`. Abandoned or failed payment drafts are not presented as completed orders.

When the Razorpay modal is dismissed, Razorpay reports a payment failure, Razorpay cannot be opened, or the Razorpay order cannot be created, the frontend calls `POST /api/payments/cancel`. The backend marks the draft as `PaymentStatus=Failed` and `Status=Cancelled`. The server-side cart is intentionally **not** cleared.

Only `POST /api/payments/verify` can transition an order to `PaymentStatus=Paid`, `Status=Confirmed`, decrement stock, and remove the purchased quantities from the server-side cart.

## Result

```text
Customer cart (Neon)
        |
        v
Create payment draft
        |
        +--> Razorpay opened
        |       |
        |       +--> Cancel/fail -> draft cancelled, cart kept
        |       |
        |       +--> Success -> server verifies signature
        |                         |
        |                         +--> Paid order + stock decrement + cart decrement
        |
        +--> Customer Orders page shows only Paid/Refunded orders
```

## Important production note

A background reconciliation/webhook flow should be added before high-volume launch so Razorpay payment states are reconciled server-to-server even if the customer's browser closes after payment. The current flow already verifies the Razorpay signature server-side and never treats a client-side success callback alone as proof of payment.
