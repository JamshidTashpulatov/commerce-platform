# Finance foundation (draft, not production-ready)

This generic schema stores approved contractual amounts and schedules separately from recorded receipts, supplier invoices and payments, and investor capital events. Amounts use integer UZS; aggregate API values are strings to preserve precision.

The endpoints are read-only and require verified store membership. Investor summary uses the session account, never an account ID supplied by a client. Existing demo screens remain disconnected from these endpoints.

No installment pricing, profit allocation, repayment agreement, collection policy or personal-document handling has been approved or implemented. The initial payment field describes the contractual amount due, not cash received; the scheduled receipts metric excludes initial payments. The finance summary is not a full accounting ledger or a cash-flow report.

Before enabling mutations, implement and test atomic posting, schedule-total reconciliation, locks against overpayment, initial-payment receipts, refund/reversal records, investor-role enforcement on writes, stock receipt/invoice reconciliation, audit events, and an immutable notification outbox. Confirm business rules and permissions before provisioning real accounts. Do not enter customer personal data or real money transactions in the demo.
