import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  // `withAuth` anexa o token do usuário ao request.
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // Se não houver token (não logado), withAuth já redireciona para /login
    // A lógica aqui é para verificações de permissão (RBAC)
    // Allow the user to access the password creation page if they have a session token.
    // The page itself is protected by requiring a valid token in the URL.
    if (pathname.startsWith('/auth/create-password')) {
      return NextResponse.next();
    }

    // The root path should be accessible to all authenticated users as a safe landing page.
    if (pathname === '/') {
      return NextResponse.next();
    }

    // RBAC Check: "Fail-closed" logic. Deny by default for all other pages.
    const permissoes = token?.permissoes || {};
    const rotaPermissao = permissoes[pathname];

    // Deny access if there is no permission entry for the route,
    // or if the 'visualizar' permission is not explicitly true.
    if (!rotaPermissao || rotaPermissao.visualizar !== true) {
      // For API routes or specific pages, one might return a 403.
      // For page navigations, redirecting to a safe page is better UX.
      const url = req.nextUrl.clone();
      url.pathname = '/login'; // Redirect to login page to break redirect loops
      url.searchParams.set('error', 'access_denied');
      // Preserve the original callbackUrl if it exists, so the user can be sent there after successful login
      if (req.nextUrl.searchParams.has('callbackUrl')) {
        url.searchParams.set('callbackUrl', req.nextUrl.searchParams.get('callbackUrl'));
      }
      return NextResponse.redirect(url);
    }

    // Se o usuário estiver logado e tiver permissão (ou a rota não for gerenciada pelo RBAC), permite o acesso.
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token, // Um usuário é autorizado se o token existir.
    },
  }
);

// Configuração do Matcher para proteger as rotas
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login (the login page itself)
     * - auth/create-password (the password creation page)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|login|auth/create-password).*)',
  ],
};
