'use client';
import { useSession } from '../lib/session';

export default function Oportunidades() {
  const { data: session } = useSession();
  return (
    <div>
      <h1>Oportunidades</h1>
      <p>Usuário: {session ? 'logado' : 'anônimo'}</p>
    </div>
  );
}
