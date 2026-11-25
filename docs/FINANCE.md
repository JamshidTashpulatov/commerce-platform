# Finance foundation (draft, not production-ready)

This generic schema stores approved contractual amounts and schedules separately from recorded receipts, supplier invoices and payments, and investor capital events. Amounts use integer UZS; aggregate API values are strings to preserve precision.

The endpoints are read-only and require verified store membership. Investor summary uses the session account, never an account ID supplied by a client. Existing demo screens remain disconnected from these endpoints.

No installment pricing, profit allocation, repayment agreement or collection policy has been approved or implemented. Manual customer-detail entry is confirmed; exact identity fields, retention and access policy remain to be approved. The initial payment field describes the contractual amount due, not cash received; the scheduled receipts metric excludes initial payments. The finance summary is not a full accounting ledger or a cash-flow report.

Before enabling mutations, implement and test atomic posting, schedule-total reconciliation, locks against overpayment, initial-payment receipts, refund/reversal records, investor-role enforcement on writes, stock receipt/invoice reconciliation, audit events, and an immutable notification outbox. Confirm business rules and permissions before provisioning real accounts. Do not enter customer personal data or real money transactions in the demo.

## Manual payment model (confirmed requirement)

The application does not accept or move money. An authorized staff member records an externally received payment against the corresponding order, installment or supplier obligation. Only recorded and confirmed receipts affect balances. Scheduled reminders do not initiate payments. Record amount, date, reference, responsible staff account and optional payment-method metadata; do not collect card numbers or credentials. Correct mistakes using audited reversal entries rather than silently editing posted receipts. No payment gateway or payment-provider credentials are required. The write workflow remains to be implemented and tested.

## Manual customer record entry (confirmed requirement)

Authorized sales staff enter customer details and, when required for an installment contract, identity-document details manually. Customers are not required to upload documents or complete automated identity verification. Collect only approved necessary fields; restrict access to authorized staff with a business need, mask sensitive values by default, audit changes without storing raw identity values in logs, and exclude identity details from investor reports and Telegram group notifications. Do not collect real identity data in the public demo. The protected form, encrypted storage, server-side access enforcement and retention controls remain to be implemented and tested.
