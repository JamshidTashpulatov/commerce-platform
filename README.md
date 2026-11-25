# Commerce Platform

A Next.js and PostgreSQL application for a store with staff-managed orders, inventory, manual receipts and investor portfolios. Start with [implementation status and open decisions](docs/NEXT-STEPS.md).

| Route | Purpose |
| --- | --- |
| `/`, `/dashboard` | Fictional storefront and management demo |
| `/catalog` | Published products, SKU availability, option photos and prices |
| `/login` | Email/password login for admins and owners, Telegram Mini App login for sellers and investors |
| `/staff` | Protected order inbox and role-specific administration |
| `/investor` | Read-only portfolio and permitted peer summaries |

## Local verification

Use Node 22.13 or newer for the TypeScript unit tests. Run `npm ci`, `npm run typecheck`, `npm test` and `npm run build`. Run `npm run dev` to start the app locally.

The Verify workflow starts a disposable PostgreSQL 17 database, applies the migrations in filename order, runs the SQL checks, then tests the production build over HTTP with synthetic data. The integration test requires an empty local database named `commerce_test`; its fixture settings are in [.github/workflows/verify.yml](.github/workflows/verify.yml).

Feature flags and server environment settings are listed in [.env.example](.env.example). Production configuration, deployment and real-data migration require a separate decision.
