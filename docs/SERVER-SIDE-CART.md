# AARPIVA Server-Side Cart

The authenticated customer cart is now authoritative in PostgreSQL rather than browser `localStorage`.

## Runtime flow

1. Customer logs in and the JWT identifies the user by `NameIdentifier` (`UserId`).
2. Angular loads `GET /api/cart`.
3. `CartController` scopes every query by the authenticated `UserId`.
4. Add/update/remove/clear operations write to `CartItems` in Neon.
5. On login, any anonymous guest cart is merged once into the authenticated cart and then removed from local storage.
6. Order creation reads the server-side cart; the client no longer supplies product IDs/prices for checkout.
7. Payment verification decrements stock and removes only the quantities that were actually ordered from the user's server-side cart.

## Database

`CartItems` has:

- `UserId`
- `ProductId`
- `Quantity`
- `CreatedAt`
- `UpdatedAt`

A unique index on `(UserId, ProductId)` guarantees one row per product per customer.

The deployed API bootstraps the table idempotently so the existing Neon database receives the new table without dropping existing data.

## Important test

Use two verified accounts:

- User A adds a product.
- Log out.
- User B logs in.
- User B must see an empty bag unless B already had items.
- Log back in as User A.
- User A's original cart must be restored from Neon.

For an authenticated add, the browser should show a request such as:

`POST https://aarpiva-api.onrender.com/api/cart/items`

The request body should contain only the product ID and quantity; prices are resolved from the database server-side.
