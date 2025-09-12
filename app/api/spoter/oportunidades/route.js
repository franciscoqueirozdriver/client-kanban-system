// app/api/spoter/oportunidades/route.js
import { NextResponse } from 'next/server';
import {
  spotterPostAndFetch,
  spotterGetByFilter,
  normalizePhonesList,
} from '@/lib/exactSpotter';

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
    const body = await req.json();

    const marker = `kanban:${body?.id || body?.codigo || 'card'}:${Date.now()}`;
    const payload = {
      'Nome do Lead': body.titulo || body.nome || body.empresa || 'Lead',
      Origem: body.origem || process.env.DEFAULT_CONTACT_ORIGEM || 'Kanban',
      Mercado: body.mercado || 'Geral',
      Telefones: normalizePhonesList(body.telefones || body.telefone),
      'Área': Array.isArray(body.areas)
        ? body.areas.join(';')
        : body.area || 'Geral',
      Etapa: body.etapa || 'Novo',
      'Telefones Contato': normalizePhonesList(
        body.telefonesContato || body.telefoneContato
      ),
      'E-mail Contato': body.emailContato,
      'Cargo Contato': body.cargoContato,
      'DDI Contato': body.ddiContato,
      'Nome Contato': body.nomeContato,
      Observação: `${body.observacoes || body.descricao || ''} | ${marker}`,
    };

    const erros = validarObrigatoriedades(payload);
    if (erros.length > 0) {
      return NextResponse.json(
        { ok: false, error: 'Campos inválidos', details: erros },
        { status: 400 }
      );
    }

    const created = await spotterPostAndFetch('Oportunidades', payload);

    let { entity, entityUrl } = created;

    if (!entity) {
      const filtro = `contains(Observação,'${marker}')`;
      const achados = await spotterGetByFilter('Oportunidades', filtro, 1);
      entity = achados[0] || null;
    }

    return NextResponse.json(
      { ok: true, status: created.status, marker, entityUrl, entity },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
