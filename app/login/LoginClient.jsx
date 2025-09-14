'use client';
import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation'; // Although not used in the new spec, it's good practice to keep for potential future use.

export default function LoginClient({ error = '', next = '' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Use useEffect to set the initial error message from the URL
  useEffect(() => {
    if (error) {
      setMsg(error === 'CredentialsSignin' ? 'Usuário ou senha inválidos.' : 'Ocorreu um erro. Tente novamente.');
    }
  }, [error]);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMsg('');

    // The new logic for signIn is more robust.
    // It only redirects if 'next' (callbackUrl) is present.
    // Otherwise, it handles errors inline.
    const res = await signIn('credentials', {
      email,
      password,
      redirect: !!next, // Coerce to boolean: redirect only if 'next' exists.
      callbackUrl: next || '/',
    });

    // This part of the logic runs only if redirect is false.
    if (!next && res && res.error) {
      setMsg(res.error === 'CredentialsSignin' ? 'Usuário ou senha inválidos.' : res.error);
    }

    // If the redirect is happening, this component might unmount, so setting state might not be necessary.
    // But if it fails before redirecting, we need to stop the loading indicator.
    setLoading(false);
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="w-full max-w-sm p-8 space-y-6 bg-white rounded-lg shadow-xl">
            <h2 className="text-2xl font-bold text-center text-gray-900">Acessar Sistema</h2>
            <form onSubmit={onSubmit} className="space-y-4">
                {msg ? <p className="p-2 text-sm text-center text-red-600 bg-red-100 rounded-md">{msg}</p> : null}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                    <input className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500" type="email"
                        value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                    <input className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500" type="password"
                        value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
                <button className="w-full bg-indigo-600 text-white rounded-md px-3 py-2 font-semibold hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400" disabled={loading}>
                    {loading ? 'Entrando...' : 'Entrar'}
                </button>
                <div className="text-center">
                    <a className="block text-sm text-indigo-600 hover:underline" href="/forgot">Esqueci minha senha</a>
                </div>
            </form>
        </div>
    </div>
  );
}
