'use client';
export default function ReportTable({ rows }) {
  return (
    <div className="overflow-auto">
      <table className="min-w-full bg-white border">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-2 py-1 border">Empresa</th>
            <th className="px-2 py-1 border">Segmento</th>
            <th className="px-2 py-1 border">Porte</th>
            <th className="px-2 py-1 border">Contato</th>
            <th className="px-2 py-1 border">Cargo</th>
            <th className="px-2 py-1 border">Telefones</th>
            <th className="px-2 py-1 border">Email</th>
            <th className="px-2 py-1 border">LinkedIn</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t hover:bg-gray-50">
              <td className="px-2 py-1 border-r">{r.company}</td>
              <td className="px-2 py-1 border-r">{r.segment}</td>
              <td className="px-2 py-1 border-r">{r.size}</td>
              <td className="px-2 py-1 border-r">{r.nome}</td>
              <td className="px-2 py-1 border-r">{r.cargo}</td>
              <td className="px-2 py-1 border-r">
                {(r.normalizedPhones || []).join(' / ')}
              </td>
              <td className="px-2 py-1 border-r">{r.email}</td>
              <td className="px-2 py-1">{r.linkedin}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

