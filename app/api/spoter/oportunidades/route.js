// app/api/spoter/oportunidades/route.js
import { NextResponse } from 'next/server';
import { createOportunidadeSpotter, normalizaListaTelefones } from '@/lib/exactSpotter';

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
    const client = await req.json(); // Expecting the raw client/card object

    // Map card data to the exact layout payload
    const payloadSpotter = {
      "Nome do Lead": client?.company ?? "Lead sem título",
      "Origem": client?.origem ?? process.env.DEFAULT_CONTACT_ORIGEM ?? "Lista Francisco",
      "Sub-Origem": client?.sub_origem ?? null,
      "Mercado": client?.segment ?? "Geral",
      "Produto": client?.produto ?? null,
      "Site": client?.site ?? null,
      "País": client?.country ?? (client.city ? 'Brasil' : null),
      "Estado": client?.uf ?? null,
      "Cidade": client?.city ?? null,
      "Logradouro": client?.address ?? null,
      "Número": client?.number ?? null,
      "Bairro": client?.neighborhood ?? null,
      "Complemento": client?.complement ?? null,
      "CEP": client?.cep ?? null,
      "DDI": "55",
      "Telefones": client?.contacts?.[0]?.normalizedPhones?.join(";") || null,
      "Observação": client?.observacoes ?? null,
      "CPF/CNPJ": client?.cnpj ?? null,
      "Email Pré-vendedor": null,
      "Nome Contato": client?.contacts?.[0]?.name ?? null,
      "E-mail Contato": client?.contacts?.[0]?.email?.split(';')[0].trim() ?? process.env.DEFAULT_CONTACT_EMAIL,
      "Cargo Contato": client?.contacts?.[0]?.role ?? null,
      "DDI Contato": "55",
      "Telefones Contato": client?.contacts?.[0]?.normalizedPhones?.join(";") || null,
      "Tipo do Serv. Comunicação": null,
      "ID do Serv. Comunicação": null,
      "Área": (Array.isArray(client?.opportunities) && client.opportunities.length > 0 ? client.opportunities.join(";") : client?.segment) ?? "Geral",
      "Nome da Empresa": client?.company ?? null,
      "Etapa": client?.status ?? "Novo",
      "Funil": client?.funil ?? null
    };

    // Run validation
    const erros = validarObrigatoriedades(payloadSpotter);
    if (erros.length > 0) {
      return NextResponse.json({ error: 'Campos inválidos', details: erros }, { status: 400 });
    }

    // Normalize phone numbers in the final payload
    payloadSpotter["Telefones"] = normalizaListaTelefones(payloadSpotter["Telefones"]);
    payloadSpotter["Telefones Contato"] = normalizaListaTelefones(payloadSpotter["Telefones Contato"]);

    const created = await createOportunidadeSpotter(payloadSpotter, {
      entitySetPath: '/Leads' // Using /Leads as a more likely placeholder
    });

    return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
