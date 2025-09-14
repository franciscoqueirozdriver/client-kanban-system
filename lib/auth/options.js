import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { getUserByEmail, updateUserByEmail } from "@/lib/auth/sheetsUsers";
import { registerFailure, registerSuccess } from "@/lib/auth/rateLimit";
import { getPermissoesDoUsuario } from "@/lib/rbac/permissoes";
import { requireEnv } from "@/lib/env";

const authOptions = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error:  "/login",
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Mantém callbackUrl interno; evita sair do domínio
      try {
        const u = new URL(url, baseUrl);
        return u.origin === baseUrl ? u.toString() : baseUrl;
      } catch {
        return baseUrl;
      }
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.permissoes = user.permissoes;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = session.user || {};
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.permissoes = token.permissoes;
      return session;
    },
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: { email: {}, password: {} },
      authorize: async (creds, req) => {
        try {
          const email = (creds?.email || "").trim().toLowerCase();
          const password = creds?.password || "";
          if (!email || !password) return null;

          const user = await getUserByEmail(email);
          if (!user || user.Ativo !== "TRUE") {
            // The prompt doesn't explicitly say to call registerFailure here,
            // but it's good practice for security to prevent user enumeration.
            // However, I will stick to the spec which is simplified.
            return null;
          }

          const now = new Date();
          if (user.Bloqueado_Ate && new Date(user.Bloqueado_Ate) > now) {
            return null; // Account is locked
          }

          const ok = await bcrypt.compare(password, user.Hash_Senha || "");
          if (!ok) {
            // The prompt is ambiguous about calling registerFailure here.
            // The simplified authorize in the prompt doesn't have it, but the rateLimit section implies it.
            // I will add it for security.
            await registerFailure(req, email);
            const currentAttempts = Number(user.Tentativas_Login || 0);
            await updateUserByEmail(email, { Tentativas_Login: currentAttempts + 1 });
            return null;
          }

          await registerSuccess(req, email);
          await updateUserByEmail(email, {
            Tentativas_Login: 0, Bloqueado_Ate: "", Ultimo_Login: new Date().toISOString()
          });

          const permissoes = await getPermissoesDoUsuario(user.Email);
          return { id: user.Usuario_ID, name: user.Nome, email: user.Email, role: user.Role, permissoes };
        } catch (e) {
          console.error("Authorize error:", e);
          return null; // Fallback to prevent 500 errors
        }
      }
    })
  ],
  secret: process.env.NEXTAUTH_SECRET,
};

export default authOptions;
