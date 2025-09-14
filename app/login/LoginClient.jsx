"use client";
import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";

export default function LoginClient({ error = "", next = "" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (error) {
      // Use a more specific error message for CredentialsSignin
      setMsg(error === "CredentialsSignin" ? "Usuário ou senha inválidos." : "Ocorreu um erro durante a autenticação.");
    }
  }, [error]);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMsg("");

    const res = await signIn("credentials", {
      email,
      password,
      redirect: !!next,
      callbackUrl: next || "/",
    });

    // This logic only runs if the redirect doesn't happen
    if (!next && res && res.error) {
      setMsg(res.error === "CredentialsSignin" ? "Usuário ou senha inválidos." : res.error);
    }
    setLoading(false);
  }

  return (
    <form onSubmit={onSubmit} className="max-w-sm mx-auto p-6 space-y-4">
      {msg ? <p className="text-sm text-red-600">{msg}</p> : null}
      <div>
        <label className="block text-sm mb-1">E-mail</label>
        <input className="w-full border rounded px-3 py-2" type="email"
               value={email} onChange={e => setEmail(e.target.value)} required />
      </div>
      <div>
        <label className="block text-sm mb-1">Senha</label>
        <input className="w-full border rounded px-3 py-2" type="password"
               value={password} onChange={e => setPassword(e.target.value)} required />
      </div>
      <button className="w-full border rounded px-3 py-2" disabled={loading}>
        {loading ? "Entrando..." : "Entrar"}
      </button>
      <a className="block text-center text-sm underline" href="/forgot">Esqueci minha senha</a>
    </form>
  );
}
