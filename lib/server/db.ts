import "server-only";
import { Pool } from "pg";
let pool: Pool | undefined;
export function database() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_NOT_CONFIGURED");
  pool ??= new Pool({connectionString,max:5,connectionTimeoutMillis:5000,idleTimeoutMillis:10000});
  return pool;
}
export function configuredStoreId() {
  const id = process.env.STORE_ID;
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error("STORE_NOT_CONFIGURED");
  return id;
}
