# Order Tracking & Returns

AARPIVA now includes a customer order area and a basic return-request workflow.

## Customer flow

1. Open **Track Order** in the footer or **Orders** in the header/account area.
2. The customer sees order items, total, delivery address, payment status and a tracking timeline.
3. The orders page refreshes automatically while it is open, so admin status updates appear without a full-page reload.
4. Return requests become available after an order reaches **Delivered** and the order is marked **Paid**.
5. The customer selects quantity and enters a reason. The request is stored as `Requested`.

## Admin flow

1. Open **Admin → Orders** to update fulfillment status.
2. Open **Admin → Returns** to review return requests.
3. Return statuses can be changed to `Requested`, `Approved`, `Rejected`, `Received`, `Refunded`, or `Cancelled`.
4. Admin notes can be saved against a return request.

## Important

The current V1 return flow stores the return request and its status. It does **not** automatically issue a Razorpay refund. A live refund workflow should be added only after the store's return policy and refund rules are finalized.

## Existing Neon databases

The application creates the `ReturnRequests` table automatically at API startup if it does not already exist, so the new feature does not require an existing Neon database to be recreated.
