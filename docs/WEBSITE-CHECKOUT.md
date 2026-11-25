# Website checkout (development)

Customers can order from the public storefront without an account: a cart (`/checkout`) or a one-click sheet on the product page. Both post to `POST /api/checkout`. A submission is a purchase request, not a sale. Staff confirm it in the existing order workflow.

## What a submission writes
- One `website_checkouts` row with a reference (`MT-XXXXXXXX`), channel (`cart` or `one_click`), and the name, phone and optional comment encrypted like customer records (AES-256-GCM, store/record/field-bound context). `phone_lookup` is the same store-scoped HMAC as `customers.phone_lookup`.
- One `orders` row per cart line (`source='website'`, `request_status='new'`, `website_checkout_id` set, no creator) with a single `order_items` line priced from the database. The order model keeps one SKU line per order because investor funding is attributed per order (see PROFIT-ALLOCATION.md).
- An `audit_events` row per order (`website_request_created`, no actor, no contact data).
- Nothing in stock, payment, receipt, funding or other finance tables. No customer record is created automatically; linking one stays a staff action.

## Server checks
Same-origin JSON only, 8 KiB body limit, hidden honeypot field, name 2–80 characters, phone `+998` and 9 digits, comment up to 500 characters, at most 20 lines and 10 per line. Variants must be active and their products published. Prices are re-read from the database; a stale `expectedPrice` returns 409 with current prices. A request key makes retries return the original reference. Limits: 10 submissions per client address and 5 per phone per rolling hour, stored only as HMACs and pruned after a day. The address is the first `X-Forwarded-For` entry, which Vercel sets; verify this against the production ingress before relying on it. Out-of-stock variants can still be requested; the seller states the lead time.

## Telegram sign-in
Optional. Uses Telegram Login (OpenID Connect, authorization code with PKCE) from https://core.telegram.org/widgets/login: `/api/customer/telegram/start` redirects to `oauth.telegram.org`, `/api/customer/telegram/callback` exchanges the code server-side, verifies the ID token signature against Telegram's JWKS and checks `iss`, `aud` (bot ID), `exp` and the nonce, and refuses replays. The phone number comes only if the customer consents to the `phone` scope. Inside the Mini App, the signed launch data opens the session directly (`/api/customer/telegram/mini-app`), with a replay key separate from the staff login.

Customer sessions live in `customer_sessions` under the `__Host-store_customer` cookie. Staff authorization reads only `sessions`, so a customer session never grants staff, seller, investor or admin access, even for a Telegram account that has such a role. Integration tests cover this.

## Configuration
- `WEBSITE_CHECKOUT_ENABLED=true` together with `CUSTOMER_RECORDS_ENABLED=true` and `CUSTOMER_DATA_KEY`. Off by default; the cart then offers copying the list for the Telegram bot.
- Telegram Login: in @BotFather open the bot's settings, choose Login Widget, add the site origin and the redirect URI `<APP_ORIGIN>/api/customer/telegram/callback` to Allowed URLs, keep the default RS256 signing, then set `TELEGRAM_LOGIN_CLIENT_ID` and `TELEGRAM_LOGIN_CLIENT_SECRET`. The site must not send `Cross-Origin-Opener-Policy: same-origin`.

## Not done
Production migration (022) and deployment need separate approval. Staff inbox grouping by checkout reference belongs to the admin workspace. Retention and deletion of website contact data, and phone verification, are still open decisions.
