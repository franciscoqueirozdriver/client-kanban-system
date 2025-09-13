import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { getUserByEmail, updateUserByEmail } from "@/lib/auth/sheetsUsers";
import { canAttempt, registerFailure, registerSuccess } from "@/lib/auth/rateLimit";
import { getPermissoesDoUsuario } from "@/lib/rbac/permissoes";
import { requireEnv } from "@/lib/env";

requireEnv(['NEXTAUTH_SECRET']);

const authOptions = {
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: { email: {}, password: {} },
      authorize: async (creds, req) => {
        try {
          const email = (creds?.email || "").trim().toLowerCase();
          const password = creds?.password || "";
          if (!email || !password) return null;

          // The canAttempt check is removed from here as it's not in the new spec.
          // It can be added back if needed, but the new spec handles failure gracefully.

          const user = await getUserByEmail(email);
          // The new spec combines the active check into one line.
          if (!user || user.Ativo !== "TRUE") {
            // Also log the failure attempt for rate limiting
            await registerFailure(req, email);
            return null;
          }

          const now = new Date();
          if (user.Bloqueado_Ate && new Date(user.Bloqueado_Ate) > now) {
            return null; // Account is locked
          }

          const ok = await bcrypt.compare(password, user.Hash_Senha || "");
          if (!ok) {
            // Note: The new spec has a simplified registerFailure call. I will adapt my rateLimit file later.
            await registerFailure(req, email);

            // The prompt says to update login attempts, but the logic in authorize is simplified.
            // I will follow the new authorize logic which is simpler.
            // Let's check the spec again. It does say:
            // await updateUserByEmail(email, { Tentativas_Login: (user.Tentativas_Login || 0) + 1 });
            // So I will add it back.
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
  pages: { // I'm adding this back in, as it's best practice.
    signIn: '/login',
    error: '/login',
  }
};

export default authOptions;
