import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  // `withAuth` anexa o token do usuário ao request.
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // Se não houver token (não logado), withAuth já redireciona para /login
    // A lógica aqui é para verificações de permissão (RBAC)
    if (token && token.permissoes) {
      // Exemplo: verificar permissão de 'visualizar' para a rota acessada
      // A chave no objeto de permissões é o path da rota, ex: '/clientes'
      const rotaPermissao = token.permissoes[pathname];

      // Se a rota está no nosso sistema de permissões mas o usuário não tem direito de visualizá-la
      if (rotaPermissao !== undefined && !rotaPermissao.visualizar) {
        // Redireciona para uma página de "acesso negado" ou para a home
        // Por enquanto, vamos redirecionar para a home com uma mensagem (hipotética)
        const url = req.nextUrl.clone();
        url.pathname = '/';
        // url.search = `error=access_denied`; // Poderia ser usado para mostrar uma mensagem
        return NextResponse.redirect(url);
      }
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
     */
    '/((?!api|_next/static|_next/image|favicon.ico|login).*)',
  ],
};
