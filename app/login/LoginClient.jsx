"use client";
import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from 'next/navigation';

export default function LoginClient({ error = "", next = "" }) {
  const [mode, setMode] = useState("login"); // 'login' or 'setup'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secretWord, setSecretWord] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();

  const { status } = useSession();

  useEffect(() => {
    // If the user lands on the login page but already has a session (even a broken one),
    // sign them out first to ensure a clean login flow.
    if (status === 'authenticated') {
      signOut({ redirect: false });
    }
  }, [status]);

  useEffect(() => {
    if (error) {
      setMsg(error === "CredentialsSignin" ? "Usuário ou senha inválidos." : "Ocorreu um erro durante a autenticação.");
    }
  }, [error]);

  async function handleLoginSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMsg("");

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res.ok) {
      // Refresh the session to get the latest data from the server (with our custom flag)
      const newSession = await updateSession();
      if (newSession?.setupRequired) {
        setMsg("Este usuário não tem uma senha configurada. Por favor, insira sua palavra secreta para continuar.");
        setMode("setup");
      } else {
        router.push(next || "/");
      }
    } else {
      setMsg(res.error === "CredentialsSignin" ? "Usuário ou senha inválidos." : res.error);
    }
    setLoading(false);
  }

  async function handleSetupSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMsg("");

    try {
      const res = await fetch('/api/auth/verify-secret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, secretWord }),
      });

      const data = await res.json();

      if (res.ok && data.token) {
        router.push(`/auth/create-password?token=${data.token}`);
      } else {
        setMsg(data.error || "Palavra secreta incorreta ou erro desconhecido.");
      }
    } catch (err) {
      setMsg("Falha ao verificar a palavra secreta. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  // The rest of the JSX remains the same as my previous implementation
  // which already handles the two modes. I will just paste it again to be sure.

  if (mode === "setup") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="w-full max-w-sm p-8 space-y-6 bg-white rounded-lg shadow-xl">
          <h2 className="text-2xl font-bold text-center text-gray-900">Criar Senha</h2>
          <form onSubmit={handleSetupSubmit} className="space-y-4">
            {msg && <p className="p-2 text-sm text-center text-red-100 bg-red-50 text-red-600 rounded-md">{msg}</p>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
              <input className="w-full border rounded px-3 py-2 bg-gray-100" type="email" value={email} disabled />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Palavra Secreta</label>
              <input className="w-full border rounded px-3 py-2" type="password" value={secretWord} onChange={e => setSecretWord(e.target.value)} required />
            </div>
            <button className="w-full border rounded px-3 py-2 bg-indigo-600 text-white font-semibold" disabled={loading}>
              {loading ? "Verificando..." : "Verificar"}
            </button>
            <button type="button" onClick={() => setMode('login')} className="block text-center text-sm underline w-full">Voltar para o login</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleLoginSubmit} className="max-w-sm mx-auto p-6 space-y-4">
      {msg ? <p className="text-sm text-red-600">{msg}</p> : null}
      <div>
        <label className="block text-sm mb-1">E-mail</label>
        <input className="w-full border rounded px-3 py-2" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
      </div>
      <div>
        <label className="block text-sm mb-1">Senha</label>
        <input className="w-full border rounded px-3 py-2" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
      </div>
      <button className="w-full border rounded px-3 py-2" disabled={loading}>
        {loading ? "Entrando..." : "Entrar"}
      </button>
      <a className="block text-center text-sm underline" href="/forgot">Esqueci minha senha</a>
    </form>
  );
}
