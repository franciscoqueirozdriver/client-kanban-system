'use client';
import { useSession } from '../lib/session';

export default function Pagamentos() {
  const { data: session } = useSession();
  return (
    <div>
      <h1>Pagamentos</h1>
      <p>Usuário: {session ? 'logado' : 'anônimo'}</p>
    </div>
  );
}
