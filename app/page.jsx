export default function Home() {
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">Bem-vindo ao Client Kanban System</h1>
      <p>Escolha uma opção no menu:</p>
      <ul className="list-disc ml-6 mt-2">
        <li><a href="/clientes" className="text-blue-600 underline">Clientes</a></li>
        <li><a href="/kanban" className="text-blue-600 underline">Kanban</a></li>
      </ul>
    </div>
  );
}

