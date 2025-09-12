import { NextResponse } from 'next/server';
import { spotterPost } from '@/lib/exactSpotter';
import { normalizePhoneList } from '@/utils/telefone';

function validatePayload(p) {
  const errs = [];
  const requiredFields = ["Nome do Lead", "Origem", "Mercado", "Telefones", "Área", "Etapa"];

  for (const f of requiredFields) {
    if (!p[f] || String(p[f]).trim() === "") {
      errs.push({ field: f, message: "Campo obrigatório" });
    }
  }

  const { "País": pais, "Estado": uf, "Cidade": cidade } = p;
  if (pais || uf || cidade) {
    if (!pais) errs.push({ field: "País", message: "Obrigatório quando Estado/Cidade forem informados" });
    if (!uf) errs.push({ field: "Estado", message: "Obrigatório quando País/Cidade forem informados" });
    if (!cidade) errs.push({ field: "Cidade", message: "Obrigatório quando País/Estado forem informados" });
  }

  const hasContactInfo = ["E-mail Contato", "Telefones Contato", "Cargo Contato", "DDI Contato"]
    .some(f => p[f] && String(p[f]).trim() !== "");
  if (hasContactInfo && (!p["Nome Contato"] || String(p["Nome Contato"]).trim() === "")) {
    errs.push({ field: "Nome Contato", message: "Obrigatório quando há dados de contato" });
  }

  const tipoCom = !!(p["Tipo do Serv. Comunicação"] && String(p["Tipo do Serv. Comunicação"]).trim());
  const idCom = !!(p["ID do Serv. Comunicação"] && String(p["ID do Serv. Comunicação"]).trim());
  if (tipoCom !== idCom) {
    errs.push({ field: "Tipo/ID do Serv. Comunicação", message: "Informe o par: Tipo e ID, ou nenhum" });
  }

  return errs;
}

export async function POST(req) {
  try {
    const payload = await req.json();

    // Normalize phone numbers first
    payload["Telefones"] = normalizePhoneList(payload["Telefones"]);
    payload["Telefones Contato"] = normalizePhoneList(payload["Telefones Contato"]);

    // Validate the payload
    const errors = validatePayload(payload);
    if (errors.length > 0) {
      return NextResponse.json({ error: 'Campos inválidos', details: errors }, { status: 400 });
    }

    // Use the centralized service to make the API call
    const created = await spotterPost('LeadsAdd', payload);

    return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (err) {
    // The service layer now throws a detailed error
    return NextResponse.json({ error: err.message || 'Erro interno no servidor' }, { status: 500 });
  }
}
