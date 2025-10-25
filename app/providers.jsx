'use client';
import { SessionProvider } from '../lib/session';

export default function Providers({ children }) {
  return <SessionProvider>{children}</SessionProvider>;
}
