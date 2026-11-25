# Implementation status

This branch includes a live database-backed workspace and separate fictional previews. See [the route map and verification commands](../README.md). Earlier module documents describe the state at the time each module was introduced.

## Implemented and covered by automated checks

- PostgreSQL migrations 001–021, store-scoped staff authorization, Telegram signed launch verification, replay protection, session issuance and logout.
- Staff-created order requests with retry protection. Confirmation changes inventory transactionally. Delivery and externally received payments have separate records.
- Customer records behind a feature flag, installment pricing snapshots and schedules, manual capital and supplier events, stock receipts and a provisional cashbook.
- Admin-created investor accounts, read-only portfolios, optional peer summaries and explicit allocation of initial principal returns to participating investors.
- Catalog editing, dynamic SKU options, image normalization, draft visibility and public catalog search. Catalog pages contain complete products. Staff order searches cover the store's full history.

## Open work in dependency order

1. **Customer ordering.** Built behind `WEBSITE_CHECKOUT_ENABLED`: cart, one-click purchase and guest checkout with name and phone, optional Telegram sign-in, and server-side validation, deduplication and rate limits ([website checkout](WEBSITE-CHECKOUT.md)). Still open: applying migration 022 in production, the staff inbox view grouped by checkout reference, phone verification policy, and retention of website contact data.
2. **Financial posting.** Investor funding weights are confirmed and captured on eligible receipts. Monthly receipts post principal and profit separately. Admins can open receipt discrepancies, reverse eligible receipts, and record the evidence that closes a review. Reconcile pre-ledger receipts and the opening balance against source records in the cashbook. Reconcile cashbook distribution semantics and opening balances. [Allocation rules](PROFIT-ALLOCATION.md) and [implemented initial returns](CAPITAL-RETURNS.md).
3. **Operational controls.** Verify request throttling against the chosen ingress, periodic execution of the tested session cleanup command, monitoring, backup restoration and reconciliation in staging. Exercise large catalogs and concurrent ledger writes under realistic load. Finish durable delivery/retry handling for any approved notifications.
4. **Private information and cutover.** Confirm staff access scope, retention, encryption-key rotation, spreadsheet mapping and reconciliation before real data enters the system. Use synthetic records for acceptance tests. Verify the actual Mini App launch on Telegram clients and review accessibility on target devices.
5. **Release.** Review staging evidence and obtain separate approval for production credentials, data migration and deployment.

No payment gateway, automatic debit or delivery charge is part of the current workflow.
