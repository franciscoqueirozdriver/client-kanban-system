'use client';
export default function ReportTable({ rows }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-background">
      <table className="min-w-full divide-y divide-border/60 text-sm text-foreground">
        <thead className="bg-muted/60">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Empresa</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Segmento</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Porte</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contato</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cargo</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Telefones</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">LinkedIn</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {rows.map((r, i) => (
            <tr key={i} className="transition hover:bg-muted/40">
              <td className="px-4 py-3 align-top font-medium text-foreground">{r.company}</td>
              <td className="px-4 py-3 align-top text-muted-foreground">{r.segment}</td>
              <td className="px-4 py-3 align-top text-muted-foreground">{r.size}</td>
              <td className="px-4 py-3 align-top text-muted-foreground">{r.nome}</td>
              <td className="px-4 py-3 align-top text-muted-foreground">{r.cargo}</td>
              <td className="px-4 py-3 align-top text-muted-foreground">
                {(r.normalizedPhones || []).join(' / ')}
              </td>
              <td className="px-4 py-3 align-top text-muted-foreground">{r.email}</td>
              <td className="px-4 py-3 align-top text-muted-foreground">{r.linkedin}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

