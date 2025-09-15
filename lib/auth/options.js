import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getUserByEmail, updateUserByEmail } from "@/lib/auth/sheetsUsers";
import { registerFailure, registerSuccess } from "@/lib/auth/rateLimit";
import { getPermissoesDoUsuario } from "@/lib/rbac/permissoes"; // Corrected path

if (process.env.VERCEL_ENV !== 'production') {
  console.log(`[Auth Options] Node.js version: ${process.versions.node}, bcrypt module: bcryptjs`);
}

/** @type {import("next-auth").AuthOptions} */
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
      // If setup is required, pass the flag and user email to the token.
      if (user?.setupRequired) {
        token.setupRequired = true;
        token.email = user.email;
        return token;
      }
      // For a normal login, pass the user's data to the token.
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.permissoes = user.permissoes;
        token.setupRequired = false; // Ensure this is false for normal users
      }
      return token;
    },
    async session({ session, token }) {
      // If the token signals a setup is required, add the flag to the session.
      if (token?.setupRequired) {
        session.setupRequired = true;
        session.user = { email: token.email };
        return session;
      }
      // For a normal session, populate the user object with data from the token.
      session.user = session.user || {};
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.permissoes = token.permissoes;
      session.setupRequired = false;
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
            return null;
          }

          // New check: if user exists but has no password, return a special object
          // that signals to the callbacks that a setup is required.
          if (!user.Hash_Senha || user.Hash_Senha.trim().length < 10) {
            return {
              id: user.Usuario_ID,
              email: user.Email,
              name: user.Nome,
              role: user.Role,
              setupRequired: true,
            };
          }

          const now = new Date();
          if (user.Bloqueado_Ate && new Date(user.Bloqueado_Ate) > now) {
            return null;
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
          return null;
        }
      }
    })
  ],
  secret: process.env.NEXTAUTH_SECRET,
};

export default authOptions;
