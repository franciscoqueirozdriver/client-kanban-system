import LoginClient from './LoginClient.jsx';

// Este é um Server Component. Ele pode receber searchParams como props.
export default function LoginPage({ searchParams }) {
  const callbackUrl = searchParams.callbackUrl || '/';

  // Mapeia os erros conhecidos do NextAuth para mensagens amigáveis.
  // A lógica de erro da nossa API (no `authorize`) já retorna mensagens amigáveis.
  const errorMessages = {
    CredentialsSignin: 'Credenciais inválidas. Verifique seu e-mail e senha.',
    // Adicione outros erros de URL do NextAuth aqui se necessário
  };

  const error = searchParams.error;
  const errorFromUrl = error ? (errorMessages[error] || 'Ocorreu um erro. Tente novamente.') : '';

  return <LoginClient callbackUrl={callbackUrl} errorFromUrl={errorFromUrl} />;
}
