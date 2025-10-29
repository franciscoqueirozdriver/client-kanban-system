import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const WHITELIST = [
  /^\/prospeccao\/pgfn(\/.*)?$/,
  /^\/api\/pgfn(\/.*)?$/,
];

export function middleware(req: NextRequest) {
  if (WHITELIST.some((regex) => regex.test(req.nextUrl.pathname))) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
