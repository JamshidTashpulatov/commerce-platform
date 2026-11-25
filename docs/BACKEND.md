# Backend foundation

Apply all migrations in filename order on an empty PostgreSQL database. The CI workflow demonstrates this with disposable fixtures. Configure the database, store and exact application origin through the server environment.

The seller and investor Mini App launch URL is `/login`. The client passes Telegram's signed launch data to `POST /api/auth/telegram-mini-app`. The server verifies signature and freshness, requires an existing store membership, consumes the assertion once and issues an eight-hour secure HttpOnly session cookie. Each protected request checks the current membership. Logout sends a same-origin JSON POST to `/api/auth/logout`, revokes that session in PostgreSQL and expires the cookie. Configure the bot and an HTTPS origin separately for a real launch.

The public catalog reads published products and active variants. Staff and investor APIs serve their role-specific workspaces. See [implementation status](NEXT-STEPS.md) for remaining work, including customer website login, private data handling and operational controls.

Run `node scripts/prune-expired-auth.mjs` with the intended database connection to remove up to 1,000 expired sessions and 1,000 expired replay assertions per run. It prints record counts. Scheduling this maintenance in production belongs to deployment configuration.

## Administrator login

Admins and owners use email and password at `/login`. The API requires a password-issued session scoped to the current store. Existing Telegram sessions cannot authorize an admin role. Use `node scripts/provision-admin.mjs` in a trusted environment with DATABASE_URL, STORE_ID and ADMIN_EMAIL to provision the first admin for an existing store. The command is idempotent and refuses to create an additional admin when another admin already exists.

Configure a random ADMIN_SETUP_CODE of at least 32 characters as a production secret. The designated admin uses `/admin/setup` to initialize their credential once, then signs in at `/login`. Remove the setup code after activation. Password verifiers use salted scrypt. Database-backed attempt limits apply across application instances.
