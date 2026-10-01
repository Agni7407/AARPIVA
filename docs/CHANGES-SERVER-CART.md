# Server Cart Changes

- Added `CartItem` EF entity and `CartItems` DbSet.
- Added unique `(UserId, ProductId)` database index and foreign keys.
- Added authenticated cart API: GET, add, update, remove, clear, sync.
- Cart queries are always scoped to JWT `UserId`.
- Added guest-cart merge on login; legacy shared `saree_cart` is removed.
- Checkout now creates orders from the server-side cart instead of trusting client item data.
- Successful payment confirmation decrements stock and removes only ordered quantities from the server cart.
- Frontend cart state now uses the API for authenticated users.
