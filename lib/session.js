'use client';
import { createContext, useContext, useState } from 'react';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [session] = useState(null);
  return (
    <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const session = useContext(SessionContext);
  return { data: session };
}
