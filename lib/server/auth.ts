import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { database } from "./db";
export type Role = "owner" | "admin" | "seller" | "investor" | "customer";
export async function requireStoreRole(storeId: string, allowed: readonly Role[]) {
  const token = (await cookies()).get("__Host-store_session")?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const hash = createHash("sha256").update(token).digest("hex");
  const { rows } = await database().query<{account_id:string;role:Role}>(
    "SELECT s.account_id,m.role FROM sessions s JOIN memberships m ON m.account_id=s.account_id WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND m.store_id=$2",
    [hash,storeId]
  );
  const membership = rows[0];
  return membership && allowed.includes(membership.role) ? membership : null;
}
// Sessions are issued only by configured, server-verified authentication endpoints.
