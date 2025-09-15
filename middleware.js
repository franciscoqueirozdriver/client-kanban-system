import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;

  // Allow unauthenticated access to login and password creation
  if (!token) {
    if (pathname === "/login" || pathname.startsWith("/auth/create-password")) {
      return NextResponse.next();
    }

    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
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
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api/auth|login|_next|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif)|forgot|reset).*)',
  ],
};
