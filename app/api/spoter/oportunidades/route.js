// app/api/spoter/oportunidades/route.js
import { NextResponse } from 'next/server';
import { spotterPost } from '@/lib/exactSpotter';
import { normalizePhoneList } from '@/utils/telefone';

// Validation function based on user's pseudocode
function validarObrigatoriedades(p) {
  const errs = [];

  // Always mandatory
  for (const f of ["Nome do Lead", "Origem", "Mercado", "Telefones", "Área", "Etapa"]) {
    if (!p[f] || String(p[f]).trim() === "") errs.push({ field: f, message: "Campo obrigatório" });
  }

  // Conditional Address
  const pais = p["País"], uf = p["Estado"], cidade = p["Cidade"];
  if (pais || uf || cidade) {
    if (!pais) errs.push({ field: "País", message: "Obrigatório quando Estado/Cidade forem informados" });
    if (!uf) errs.push({ field: "Estado", message: "Obrigatório quando País/Cidade forem informados" });
    if (!cidade) errs.push({ field: "Cidade", message: "Obrigatório quando País/Estado forem informados" });
  }

  // Conditional Contact
  const contatoPreenchido = ["E-mail Contato", "Telefones Contato", "Cargo Contato", "DDI Contato"]
    .some(f => p[f] && String(p[f]).trim() !== "");
  if (contatoPreenchido && (!p["Nome Contato"] || String(p["Nome Contato"]).trim() === "")) {
    errs.push({ field: "Nome Contato", message: "Obrigatório quando há dados de contato" });
  }

  // Paired Communication fields
  const tipoCom = !!(p["Tipo do Serv. Comunicação"] && String(p["Tipo do Serv. Comunicação"]).trim());
  const idCom = !!(p["ID do Serv. Comunicação"] && String(p["ID do Serv. Comunicação"]).trim());
  if (tipoCom !== idCom) {
    errs.push({ field: "Tipo/ID do Serv. Comunicação", message: "Informe o par: Tipo e ID, ou nenhum" });
  }

  return errs;
}

export async function POST(req) {
  try {
    const payloadSpotter = await req.json(); // Expecting the final payload from the modal form

    // Normalize phone numbers before validation, as validation depends on them
    payloadSpotter["Telefones"] = normalizePhoneList(payloadSpotter["Telefones"]);
    payloadSpotter["Telefones Contato"] = normalizePhoneList(payloadSpotter["Telefones Contato"]);

    // Run validation
    const erros = validarObrigatoriedades(payloadSpotter);
    if (erros.length > 0) {
      return NextResponse.json({ error: 'Campos inválidos', details: erros }, { status: 400 });
    }

      const created = await spotterPost('Oportunidades', payloadSpotter);

    return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
