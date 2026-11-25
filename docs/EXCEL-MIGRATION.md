# Existing spreadsheet workflow — discovery and migration plan
The existing workbook layout and formulas are not yet available. Do not assume sheet names, columns, business rules, or historical data quality.
First review a sanitized workbook with synthetic identifiers and amounts. Retain formulas, column headings, date formats, sheet relationships and a representative set of rows. Remove actual customer names, phone numbers, passport/ID details, and private financial information before sharing.
Proposed migration sequence:
1. Map workbook columns to orders, payments, customers, installment schedules, funding allocations, investor capital events and supplier records.
2. Validate dates, integer UZS amounts, duplicate identifiers and cross-sheet references. Compare formula results against the server implementation.
3. Dry-run into an isolated staging database with row-level validation errors, no production writes.
4. Reconcile per-sheet totals and balances as of an agreed cutover date; review discrepancies with the business owner.
5. Import only approved records using stable source IDs and idempotency checks. Keep a backup and a restricted audit log.
6. Provide scoped spreadsheet exports excluding private identity fields by default and neutralize spreadsheet formula injection.
This is a migration discovery plan, not an implemented import/export feature. Do not commit real spreadsheets or financial or identity data into this public repository.
