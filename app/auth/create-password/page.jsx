import CreatePasswordClient from './CreatePasswordClient';

export const dynamic = 'force-dynamic';

export default function CreatePasswordPage({ searchParams }) {
  const token = searchParams?.token;

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-500">Token de autorização inválido ou ausente.</p>
      </div>
    );
  }

  return <CreatePasswordClient token={token} />;
}
