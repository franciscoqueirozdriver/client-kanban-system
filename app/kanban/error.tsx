// app/kanban/error.tsx
'use client';
export default function Error({ error }: { error: Error & { digest?: string } }) {
  return (
    <div className="p-6 text-red-600">
      Ocorreu um erro ao carregar o Kanban.
      {error?.digest && <div className="text-xs opacity-70">Digest: {error.digest}</div>}
    </div>
  );
}
