'use client';
import { useState } from 'react';

export default function ClientCard({ client }) {
  const [selected, setSelected] = useState(false);

  const handleDoubleClick = async () => {
    setSelected(true);
    await fetch('/api/kanban', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: client.id, destination: { droppableId: 'Lead Selecionado' } }),
    });
  };

  return (
    <div
      onDoubleClick={handleDoubleClick}
      className={`p-4 border rounded shadow bg-white hover:shadow-lg cursor-pointer ${selected ? 'bg-green-200' : ''}`}
    >
      <h3 className="text-lg font-semibold mb-2">{client.company}</h3>
      <div className="space-y-2">
        {client.contacts.map((c, idx) => (
          <div key={idx} className="text-sm border-t pt-1">
            <p className="font-medium">{c.nome}</p>
            <p className="text-xs">{c.cargo}</p>
            <p className="text-xs">
              <a href={`mailto:${c.email}`} className="text-blue-600 underline">
                {c.email}
              </a>
            </p>
            <p className="text-xs">
              <a
                href={`https://wa.me/55${c.telefone}`}
                className="text-green-600 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {c.telefone}
              </a>
              {c.celular && (
                <span>
                  {' '}/{' '}
                  <a
                    href={`https://wa.me/55${c.celular}`}
                    className="text-green-600 underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {c.celular}
                  </a>
                </span>
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
