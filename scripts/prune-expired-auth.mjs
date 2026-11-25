import pg from "pg";
import { pathToFileURL } from "node:url";

// A single bounded batch per invocation keeps maintenance transactions short.
export async function pruneExpiredAuth(client) {
  await client.query("BEGIN");
  try {
    const sessions = await client.query(`
      DELETE FROM sessions WHERE token_hash IN (
        SELECT token_hash FROM sessions WHERE expires_at <= now()
        ORDER BY expires_at LIMIT 1000 FOR UPDATE SKIP LOCKED
      )`);
    const assertions = await client.query(`
      DELETE FROM telegram_auth_assertions WHERE assertion_hash IN (
        SELECT assertion_hash FROM telegram_auth_assertions WHERE expires_at <= now()
        ORDER BY expires_at LIMIT 1000 FOR UPDATE SKIP LOCKED
      )`);
    await client.query("COMMIT");
    return { sessions: sessions.rowCount, assertions: assertions.rowCount };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL before running maintenance");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    console.log(JSON.stringify(await pruneExpiredAuth(client)));
  } catch {
    console.error("Expired authentication records could not be pruned");
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
