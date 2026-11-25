import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { database } from "./db";
export type Role = "owner" | "admin" | "seller" | "investor" | "customer";
export const sessionCookie = "__Host-store_session";
export const cookieOptions = { httpOnly: true, secure: true, sameSite: "lax", path: "/" } as const;

export async function currentSessionHash() {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return createHash("sha256").update(token).digest("hex");
}

export async function requireStoreRole(storeId: string, allowed: readonly Role[]) {
  const hash = await currentSessionHash();
  if (!hash) return null;
  const { rows } = await database().query<{account_id:string;role:Role}>(
    "SELECT s.account_id,m.role FROM sessions s JOIN memberships m ON m.account_id=s.account_id WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND m.store_id=$2 AND ((m.role IN ('admin','owner') AND s.password_store_id=m.store_id) OR (m.role NOT IN ('admin','owner') AND s.password_store_id IS NULL))",
    [hash,storeId]
  );
  const membership = rows[0];
  return membership && allowed.includes(membership.role) ? membership : null;
}
// Sessions are issued only by configured, server-verified authentication endpoints.
