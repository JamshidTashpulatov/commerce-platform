# Order workflow — confirmed direction

## Customer-facing storefront
- Discover a product, open its detail page and choose available variant attributes (including storage and color where applicable) and quantity.
- Offer a direct purchase-request action independent of the cart.
- Request contact phone number and authenticate through Telegram before submitting an order request. A Telegram identity does not by itself prove phone ownership; contact-number verification policy remains to be decided.
- Server must validate product and variant availability and deduplicate requests. A submitted request is not a completed sale or a payment.
- Acknowledge the request and explain that staff will contact the customer.
- No online payments, customer-entered identity documents, contract financing selection, or investor details on the storefront.

## Staff workspace
- New customer requests appear in the authorized order inbox. Staff can also create orders independently.
- Seller contacts the customer and records agreed conditions manually, including customer details, order outcome, fulfillment, financing terms, initial amount received, payment schedule and one or more funding sources.
- Customer records and authenticated customer accounts are distinct entities; linking them requires a verified or authorized staff workflow.
- Keep request lifecycle, sale status, fulfillment status and payment status separate. A request is not revenue; delivery is not proof of payment.
- Funding allocations support multiple sources per order; contributions are separate from revenue, payment receipts and investor distributions.
- Staff record external payments only. No money movement is performed by the application.
- Store only necessary approved identity data in a protected system. Never include it in group notifications, public demo data or investor reports.
- Oral agreements may occur outside the application. Record terms and confirmation status without implying a legally valid signed contract; exact evidence and legal requirements remain to be reviewed.

## Implementation notes
Current public preview uses fictional data. This document describes intended behavior, not completed features. Production requires secure authenticated order creation, staff authorization, transactional writes, audit trails, contact verification decisions, contract policy and funding reconciliation. Detailed business formulas and private commercial terms are not included here.
