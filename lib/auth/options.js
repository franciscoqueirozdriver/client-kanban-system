import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { getUserByEmail, updateUserByEmail } from "@/lib/auth/sheetsUsers";
import { registerFailure, registerSuccess } from "@/lib/auth/rateLimit";
import { getPermissoesDoUsuario } from "@/lib/rbac/permissoes";
import { requireEnv } from "@/lib/env";

requireEnv(['NEXTAUTH_SECRET']);

const authOptions = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: '/login',
    error: '/login',
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
            await registerFailure(req, email);
            return null;
          }

          const now = new Date();
          if (user.Bloqueado_Ate && new Date(user.Bloqueado_Ate) > now) {
            return null; // Account is locked
          }

          const ok = await bcrypt.compare(password, user.Hash_Senha || "");
          if (!ok) {
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
  callbacks: {
    async redirect({ url, baseUrl }) {
      // This logic ensures that redirects are safe and stay within the application.
      try {
        const urlObject = new URL(url, baseUrl);
        // Allow redirects only to the same origin.
        if (urlObject.origin === baseUrl) {
          return urlObject.toString();
        }
        // If the redirect URL is for a different origin, redirect to the base URL.
        return baseUrl;
      } catch (e) {
        // In case of any URL parsing error, default to the base URL.
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
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export default authOptions;
