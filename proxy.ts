import { NextResponse, type NextRequest } from "next/server";

const COOKIE_NAME = "meally_auth";

// Hashes the password rather than the proxy storing/comparing it raw, so
// the cookie value itself isn't the literal password.
async function expectedToken(password: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  return Buffer.from(digest).toString("hex");
}

export async function proxy(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  // No password configured (e.g. local dev without one set) — no gate.
  if (!password) return NextResponse.next();

  if (request.nextUrl.pathname === "/login") return NextResponse.next();

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (token && token === (await expectedToken(password))) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
