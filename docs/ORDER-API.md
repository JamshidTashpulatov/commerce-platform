# Staff order API (implementation draft)
The protected routes use server-verified staff sessions and store scope. Configure a disposable database first and apply migrations in order. Same-origin JSON is required for writes.

- GET /api/admin/orders: list requests, separate sale and fulfillment states.
- POST /api/admin/orders: create a staff request with variantId, quantity, requestKey (UUID). The server reads price; stock is not reserved by a request.
- GET /api/admin/orders/:id: fetch request and items.
- PATCH /api/admin/orders/:id: change request status with revision and status.
- POST /api/admin/orders/:id/sale: confirm sale with revision, atomically decrement inventory and write audit entries.
- PUT /api/admin/orders/:id: set fulfillment with revision and fulfillment. Delivery requires confirmed sale.

The revision is an optimistic concurrency guard. Do not use these endpoints with real transactions until security, authorization, end-to-end tests, audit/reversal procedures and business policies are reviewed. Confirming a sale records inventory movement only; it does not record a payment or finalize contractual terms. Staff role access currently covers store-wide orders; assignment rules are not yet decided. Website OIDC, customer records, funding allocation writes, manual receipt posting and staff UI connection remain pending. No real customer details are collected.
