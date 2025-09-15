import Credentials from "next-auth/providers/credentials";
import bcryptjs from "bcryptjs";
import { getUserByEmail, updateUserMeta } from "@/lib/auth/sheetsUsers";

const authOptions = {
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email;
        const password = credentials.password;

        const user = await getUserByEmail(email);

        if (!user || !user.Ativo) {
          return null; // User not found or inactive
        }

        if (user.Bloqueado_Ate && new Date(user.Bloqueado_Ate) > new Date()) {
          // Could throw a specific error here, but null is simpler for v1
          return null;
        }

        if (!user.Hash_Senha) {
          // For v1, we just deny login. v2 can handle a setup flow.
          // Throwing an error provides more info to the client.
          throw new Error("Senha não definida para este usuário.");
        }

        const passwordsMatch = await bcryptjs.compare(password, user.Hash_Senha);

        if (passwordsMatch) {
          // On successful login, update metadata
          await updateUserMeta(user._rowNumber, {
            Ultimo_Login: new Date().toISOString(),
            Tentativas_Login: 0,
            Bloqueado_Ate: "",
          });

          return {
            id: user.Usuario_ID,
            email: user.Email,
            name: user.Nome,
            role: user.Role,
          };
        }

        // If password does not match, for now, just fail.
        // v2 can add attempt counting and lockout.
        return null;
      }
    })
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    }
  }
};

export default authOptions;
