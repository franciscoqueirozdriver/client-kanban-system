import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.next();
  }
  const token = await getToken({ req, secret });
  const { pathname } = req.nextUrl;

  // Allow unauthenticated access to login and password creation
  if (!token) {
    if (pathname === "/login" || pathname.startsWith("/auth/create-password")) {
      return NextResponse.next();
    }

    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    const res = NextResponse.redirect(url);
    if (process.env.VERCEL_ENV === "preview") {
      res.headers.set("X-From-Middleware", "1");
    }
    return res;
  }

  // Avoid redirect loop if already on login while authenticated
  if (pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Allow authenticated users to access root and password creation pages
  if (pathname === "/" || pathname.startsWith("/auth/create-password")) {
    return NextResponse.next();
  }

  // RBAC check
  const permissoes = token.permissoes || {};
  const rotaPermissao = permissoes[pathname];
  if (!rotaPermissao || rotaPermissao.visualizar !== true) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "access_denied");
    url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    const res = NextResponse.redirect(url);
    if (process.env.VERCEL_ENV === "preview") {
      res.headers.set("X-From-Middleware", "1");
    }
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api/.*|_next/.*|favicon.ico|assets/.*|login|forgot|reset|.*\\.(?:png|jpg|jpeg|svg|gif)).*)',
  ],
};
