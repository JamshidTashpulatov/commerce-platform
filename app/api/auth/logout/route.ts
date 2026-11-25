import { NextResponse } from "next/server";
import { cookieOptions, currentSessionHash, sessionCookie } from "../../../../lib/server/auth";
import { database } from "../../../../lib/server/db";
import { privateHeaders, sameOrigin } from "../../../../lib/server/http";

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Ruxsat yo‘q" }, { status: 403, headers: privateHeaders });
  }
  try {
    const hash = await currentSessionHash();
    if (hash) {
      await database().query(
        "UPDATE sessions SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL",
        [hash]
      );
    }
    const response = NextResponse.json({ ok: true }, { headers: privateHeaders });
    response.cookies.set(sessionCookie, "", { ...cookieOptions, maxAge: 0 });
    return response;
  } catch {
    return NextResponse.json({ error: "Chiqish bajarilmadi. Qayta urinib ko‘ring." }, { status: 503, headers: privateHeaders });
  }
}
