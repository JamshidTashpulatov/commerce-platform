# Staff order API (implementation draft)
The protected routes use server-verified staff sessions and store scope. Configure a disposable database first and apply migrations in order. Same-origin JSON is required for writes.

- GET /api/admin/orders: list requests, separate sale and fulfillment states.
- POST /api/admin/orders: create a staff request with variantId, quantity, requestKey (UUID). The server reads price; stock is not reserved by a request.
- GET /api/admin/orders/:id: fetch request and items.
- PATCH /api/admin/orders/:id: change request status with revision and status.
- POST /api/admin/orders/:id/sale: confirm sale with revision, atomically decrement inventory and write audit entries.
- PUT /api/admin/orders/:id: set fulfillment with revision and fulfillment. Delivery requires confirmed sale.

The revision is an optimistic concurrency guard. Do not use these endpoints with real transactions until security, authorization, end-to-end tests, audit/reversal procedures and business policies are reviewed. Confirming a sale records inventory movement only; it does not record a payment or finalize contractual terms. Staff role access currently covers store-wide orders; assignment rules are not yet decided. Website OIDC, customer records, funding allocation writes, manual receipt posting and staff UI connection remain pending. No real customer details are collected.

## Server-connected staff preview

The separate /staff workspace supports listing, filtering, opening and creating staff order requests and updating sale and delivery status using the protected API. It is disabled by default; STAFF_WORKSPACE_ENABLED=true exposes the UI only to an existing authorized staff session. The /dashboard route remains fictional-data preview. The flag gates the UI, not the underlying authenticated API. Test with a disposable database, not real inventory or customers. Staff login is available through /login. See NEXT-STEPS.md for release blockers. The inbox searches the full store by order ID and request status. GET supports q, status and an after cursor. Each page contains up to 100 orders and returns the next cursor.
