interface PerdcompParams {
  cnpj: string;
  perdcomp?: string;
  timeoutSeconds?: number;
}

export async function consultarPerdcomp({ cnpj, perdcomp, timeoutSeconds }: PerdcompParams) {
  const token = process.env.INFOSIMPLES_TOKEN;
  if (!token) throw new Error('INFOSIMPLES_TOKEN missing');
  const url = 'https://api.infosimples.com/api/v2/consultas/receita-federal/perdcomp';
  const body: any = { token, cnpj };
  if (perdcomp) body.perdcomp = perdcomp;
  if (timeoutSeconds) body.timeout = timeoutSeconds;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Infosimples error: ${res.status}`);
  }
  return res.json();
}
