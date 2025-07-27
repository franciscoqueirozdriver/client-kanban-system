'use client';
import { useState } from 'react';

function getWhatsAppLink(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : '';
}

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
            {[
              ['phone_work', 'Phone (Work)'],
              ['phone_home', 'Phone (Home)'],
              ['phone_mobile', 'Phone (Mobile)'],
              ['phone_other', 'Phone (Other)'],
              ['telefone', 'Telefone'],
              ['celular', 'Celular'],
            ].map(([key, label]) => {
              const num = c[key];
              if (!num) return null;
              return (
                <p key={key} className="text-xs">
                  {label}:{' '}
                  <a
                    href={getWhatsAppLink(num)}
                    className="text-green-600 underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {num}
                  </a>
                </p>
              );
            })}
            {c.linkedin_contato && (
              <p className="text-xs">
                <a
                  href={c.linkedin_contato}
                  className="text-blue-600 underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  LinkedIn
                </a>
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
