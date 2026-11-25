# Implementation status
This is a public demonstration, not a production application.

## Included
- Responsive storefront, search, category filters, product variant selection, in-memory cart and comparison.
- Demo management dashboard with order filters, counts, order totals and catalog inventory.
- Shared CSS tokens and original placeholder vector product illustrations.

## Required before production
- Confirm private repository and business requirements.
- Add PostgreSQL persistence, migrations and transactional inventory.
- Server-verified identity, sessions, role and tenant authorization on every protected request.
- No personal documents or production credentials in public code, logs or messaging groups.
- Confirm contractual/payment calculations and test rounding, refunds, partial and missed payments.
- Add authorized staff-only manual payment recording, audit log, reconciliation, messaging outbox and retries. No payment gateway, online card collection or automatic debit is in scope.
- Add consent, data retention, and authorized access for identity data.
- Connect Telegram login/bot and authorized Mini App only using server-side verification.
- Automated integration tests, visual review, accessibility review, deployment and monitoring.

The demo does not record real payments, authenticate real users or collect identity documents. The production payment workflow will record externally received payments manually; the application will not transfer money.
