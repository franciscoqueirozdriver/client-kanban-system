import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { getUserByEmail, updateUserByEmail } from "@/lib/auth/sheetsUsers";
import { registerFailure, registerSuccess } from "@/lib/auth/rateLimit";
import { getPermissoesDoUsuario } from "@/lib/rbac/permissoes"; // Corrected path

const authOptions = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error:  "/login",
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      try {
        const u = new URL(url, baseUrl);
        return u.origin === baseUrl ? u.toString() : baseUrl;
      } catch { return baseUrl; }
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
          const log = (...args) => {
            if (process.env.NODE_ENV !== "production") console.log("[authorize]", ...args);
          };
          if (!email || !password) {
            log("missing-credentials");
            return null;
          }

          const user = await getUserByEmail(email);
          if (!user) {
            log("user-not-found");
            return null;
          }
          if (user.Ativo !== "TRUE") {
            log("inactive");
            return null;
          }

          const now = new Date();
          if (user.Bloqueado_Ate && new Date(user.Bloqueado_Ate) > now) {
            log("blocked");
            return null;
          }

          const ok = await bcrypt.compare(password, user.Hash_Senha || "");
          if (!ok) {
            await registerFailure(req, email);
            const currentAttempts = Number(user.Tentativas_Login || 0);
            await updateUserByEmail(email, { Tentativas_Login: currentAttempts + 1 });
            log("bcrypt-compare-failed");
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
          return null;
        }
      }
    })
  ],
  secret: process.env.NEXTAUTH_SECRET,
};

export default authOptions;
