import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { getUserByEmail, updateUserByEmail } from "../../../../lib/auth/sheetsUsers.js";
import { canAttempt, registerFailure, registerSuccess } from "../../../../lib/auth/rateLimit.js";
import { getPermissoesDoUsuario } from "../../../../lib/rbac/permissoes.js";

const LOCKOUT_MIN = parseInt(process.env.LOCKOUT_MIN || '20', 10);
const RATE_LIMIT_MAX_ATTEMPTS = parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS || '5', 10);

const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        // 1. Obter IP e normalizar email
        const ip = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || req.socket?.remoteAddress;
        const email = (credentials?.email || "").trim().toLowerCase();
        const password = credentials?.password || "";

        if (!email || !password) {
          throw new Error("Por favor, forneça e-mail e senha.");
        }

        try {
          // 2. Verificar Rate Limiting antes de consultar o banco
          const attemptInfo = canAttempt(ip, email);
          if (!attemptInfo.allowed) {
            const minutes = Math.ceil((attemptInfo.resetAt - Date.now()) / 60000);
            throw new Error(`Muitas tentativas. Tente novamente em ${minutes} minuto(s).`);
          }

          // 3. Buscar usuário
          const user = await getUserByEmail(email);

          if (!user) {
            registerFailure(ip, email);
            throw new Error("Credenciais inválidas.");
          }

          // 4. Verificar se a conta está ativa
          if (user.Ativo !== "TRUE") {
            throw new Error("Esta conta está inativa.");
          }

          // 5. Verificar se a conta está bloqueada
          if (user.Bloqueado_Ate) {
            const bloquedUntil = new Date(user.Bloqueado_Ate);
            if (bloquedUntil > new Date()) {
              throw new Error(`Conta bloqueada até ${bloquedUntil.toLocaleTimeString('pt-BR')}.`);
            }
          }

          // 6. Comparar senha
          const isPasswordCorrect = await bcrypt.compare(password, user.Hash_Senha);

          if (!isPasswordCorrect) {
            const newAttemptCount = registerFailure(ip, email);
            const updates = { Tentativas_Login: newAttemptCount };

            // Se exceder o limite, bloqueia a conta
            if (newAttemptCount >= RATE_LIMIT_MAX_ATTEMPTS) {
                const lockoutUntil = new Date(Date.now() + LOCKOUT_MIN * 60 * 1000);
                updates.Bloqueado_Ate = lockoutUntil.toISOString();
            }

            await updateUserByEmail(email, updates);
            throw new Error("Credenciais inválidas.");
          }

          // 7. Sucesso no Login
          registerSuccess(ip, email);

          // Resetar tentativas de login e bloqueio, e registrar último login
          const updatesOnSuccess = {
            Tentativas_Login: 0,
            Bloqueado_Ate: "",
            Ultimo_Login: new Date().toISOString(),
          };
          await updateUserByEmail(email, updatesOnSuccess);

          // 8. Carregar permissões
          const permissoes = await getPermissoesDoUsuario(user.Email);

          // 9. Retornar objeto do usuário para a sessão
          return {
            id: user.Usuario_ID,
            name: user.Nome,
            email: user.Email,
            role: user.Role,
            permissoes: permissoes,
          };

        } catch (error) {
          // Log do erro no servidor para depuração
          console.error("[NextAuth Authorize] Erro:", error.message);
          // Re-lança o erro para que o NextAuth o envie ao cliente
          throw new Error(error.message || "Ocorreu um erro durante a autenticação.");
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Na primeira vez (login), o objeto 'user' do authorize está disponível
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.permissoes = user.permissoes;
      }
      return token;
    },
    async session({ session, token }) {
      // A cada request, a sessão é atualizada com os dados do token
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.permissoes = token.permissoes;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    error: "/login", // Redireciona para /login em caso de erro
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
