'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CreatePasswordClient({ token }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    if (password.length < 8) {
      setError('A senha deve ter no mínimo 8 caracteres.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess('Senha criada com sucesso! Você será redirecionado para o login.');
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      } else {
        setError(data.error || 'Ocorreu um erro ao criar a senha.');
      }
    } catch (err) {
      setError('Falha na comunicação com o servidor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-sm p-8 space-y-6 bg-white rounded-lg shadow-xl">
        <h2 className="text-2xl font-bold text-center text-gray-900">Crie sua Nova Senha</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="p-2 text-sm text-center text-red-600 bg-red-100 rounded-md">{error}</p>}
          {success && <p className="p-2 text-sm text-center text-green-600 bg-green-100 rounded-md">{success}</p>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nova Senha</label>
            <input
              className="w-full border rounded px-3 py-2"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              disabled={!!success}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Nova Senha</label>
            <input
              className="w-full border rounded px-3 py-2"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              disabled={!!success}
            />
          </div>
          <button className="w-full border rounded px-3 py-2 bg-indigo-600 text-white font-semibold" disabled={loading || !!success}>
            {loading ? 'Salvando...' : 'Salvar Nova Senha'}
          </button>
        </form>
      </div>
    </div>
  );
}
