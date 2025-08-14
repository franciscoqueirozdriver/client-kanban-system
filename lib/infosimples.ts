// @ts-nocheck
import { URLSearchParams } from 'url';

export async function consultarPerdcomp({ cnpj, periodoInicio, periodoFim }) {
  const token = process.env.INFOSIMPLES_TOKEN;
  if (!token) {
    throw new Error('INFOSIMPLES_TOKEN not configured');
  }
  const params = new URLSearchParams({ token, cnpj });
  if (periodoInicio) params.append('periodo_inicio', periodoInicio);
  if (periodoFim) params.append('periodo_fim', periodoFim);

  const url = `https://api.infosimples.com/api/v2/consultas/receita-federal/perdcomp?${params.toString()}`;

  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Infosimples request failed: ${res.status} ${text}`);
  }
  return res.json();
}
