'use client';
import { useState } from 'react';

function getWhatsAppLink(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : '';
}

export default function ClientCard({ client }) {
  const [color, setColor] = useState(client.color || '');

  const handleDoubleClick = async () => {
    const newColor = 'green';
    setColor(newColor);
    await fetch('/api/kanban', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: client.id,
        status: 'Lead Selecionado',
        color: newColor,
      }),
    });
  };

  return (
    <div
      onDoubleClick={handleDoubleClick}
      style={{
        backgroundColor:
          color === 'green' ? '#22c55e' : color === 'red' ? '#ef4444' : 'white',
      }}
      className="p-4 border rounded shadow hover:shadow-lg cursor-pointer"
    >
      <h3 className="text-lg font-semibold mb-1">{client.company}</h3>
      {(client.city || client.uf) && (
        <p className="text-xs text-gray-600">
          {[client.city, client.uf].filter(Boolean).join(' - ')}
        </p>
      )}
      {client.opportunities.length > 0 && (
        <ul className="text-xs list-disc ml-4 my-2">
          {client.opportunities.map((o, i) => (
            <li key={i}>{o}</li>
          ))}
        </ul>
      )}
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
            {c.telefone && (
              <p className="text-xs">
                Telefone:{' '}
                <a
                  href={getWhatsAppLink(c.telefone)}
                  className="text-green-600 underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {c.telefone}
                </a>
              </p>
            )}
            {c.celular && (
              <p className="text-xs">
                Celular:{' '}
                <a
                  href={getWhatsAppLink(c.celular)}
                  className="text-green-600 underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {c.celular}
                </a>
              </p>
            )}
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
