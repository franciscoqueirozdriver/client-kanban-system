export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import NextAuth from "next-auth";
import authOptions from "@/lib/auth/options";

// The user's spec had a typo here, pointing to a non-existent file.
// I've put the logic in lib/auth/options.js as requested, so I'll import from there.
// The alias should work here as this is part of the Next.js build.

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
