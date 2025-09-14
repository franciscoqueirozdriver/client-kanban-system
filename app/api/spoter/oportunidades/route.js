import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/options';
import { temPermissao } from '@/lib/rbac/checker';
import { spotterPost } from '@/lib/exactSpotter';
import { normalizePhoneList } from '@/utils/telefone.js';

// Mapping from user-facing layout names to the actual API field names
const apiFieldMap = {
  "Nome do Lead": "name",
  "Origem": "source",
  "Sub-Origem": "subSource",
  "Mercado": "industry",
  "Produto": "leadProduct",
  "Site": "website",
  "País": "country",
  "Estado": "state",
  "Cidade": "city",
  "Logradouro": "address",
  "Número": "addressNumber",
  "Bairro": "neighborhood",
  "Complemento": "addressComplement",
  "CEP": "zipcode",
  "DDI": "ddiPhone",
  "Telefones": "phone",
  "Observação": "description",
  "CPF/CNPJ": "cpfcnpj",
  "Nome Contato": "personName", // Assuming, not in doc example but logical
  "E-mail Contato": "personEmail", // Assuming
  "Cargo Contato": "personRole", // Assuming
  "DDI Contato": "personDdiPhone", // Assuming
  "Telefones Contato": "personPhone", // Assuming
  "Área": "area", // Not in doc, but in user's layout
  "Nome da Empresa": "companyName", // Not in doc, but in user's layout
  "Etapa": "stage",
  "Funil": "funnelId", // The API expects an ID here, might need adjustment
  // Fields not in the modal form but in the API docs
  "organizationId": null,
  "sdrEmail": null,
  "group": null,
  "mktLink": null,
  "ddiPhone2": null,
  "phone2": null
};


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

  const hasContactInfo = ["E-mail Contato", "Telefones Contato", "Cargo Contato"].some(f => p[f] && String(p[f]).trim() !== "");
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
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const formPayload = await req.json();
    const sourceRoute = formPayload.sourceRoute; // e.g., '/kanban' or '/clientes'

    if (!sourceRoute || (sourceRoute !== '/kanban' && sourceRoute !== '/clientes')) {
      return NextResponse.json({ error: 'Rota de origem inválida para a ação.' }, { status: 400 });
    }

    // Defense in Depth: Check for 'enviar_spotter' and 'visualizar' or 'editar' permissions
    const canSend = temPermissao(session, sourceRoute, 'enviar_spotter');
    const canAccess = temPermissao(session, sourceRoute, 'visualizar') || temPermissao(session, sourceRoute, 'editar');

    if (!canSend || !canAccess) {
      // TODO: Add to Audit Log here
      return NextResponse.json({ error: 'Permissão negada.' }, { status: 403 });
    }

    // 1. Normalize phone numbers first, as validation depends on them
    formPayload["Telefones"] = normalizePhoneList(formPayload["Telefones"]);
    formPayload["Telefones Contato"] = normalizePhoneList(formPayload["Telefones Contato"]);

    // 2. Validate the incoming data using user-defined rules
    const errors = validatePayload(formPayload);
    if (errors.length > 0) {
      return NextResponse.json({ error: 'Campos inválidos', details: errors }, { status: 400 });
    }

    // 3. Map the validated form payload to the API payload structure
    const apiLeadObject = {};
    for (const layoutKey in formPayload) {
        const apiKey = apiFieldMap[layoutKey];
        if (apiKey) {
            // Ensure we don't send empty strings for optional fields, send null instead
            apiLeadObject[apiKey] = formPayload[layoutKey] || null;
        }
    }

    // Handle the separate person fields from the docs
    apiLeadObject.person = {
        name: formPayload['Nome Contato'],
        email: formPayload['E-mail Contato'],
        role: formPayload['Cargo Contato'],
        ddiPhone: formPayload['DDI Contato'],
        phone: formPayload['Telefones Contato']
    };

    // The documentation shows the contact fields are not top-level
    // but I can't see where they go. The example has no "person" object.
    // I will assume for now they are top-level with a "person" prefix.
    // Re-reading docs: `name` is `Nome do lead`. `industry` is `Mercado`.
    // The example body has no separate person object. It seems the fields are flat.
    // I will remap based on the documentation fields.
    const finalApiPayload = {
        name: formPayload["Nome do Lead"],
        industry: formPayload["Mercado"],
        source: formPayload["Origem"],
        subSource: formPayload["Sub-Origem"],
        website: formPayload["Site"],
        leadProduct: formPayload["Produto"],
        address: formPayload["Logradouro"],
        addressNumber: formPayload["Número"],
        addressComplement: formPayload["Complemento"],
        neighborhood: formPayload["Bairro"],
        zipcode: formPayload["CEP"],
        city: formPayload["Cidade"],
        state: formPayload["Estado"],
        country: formPayload["País"],
        description: formPayload["Observação"],
        cpfcnpj: formPayload["CPF/CNPJ"],
        funnelId: formPayload["Funil"] ? parseInt(formPayload["Funil"], 10) : null,
        stage: formPayload["Etapa"],
        // The docs show ddiPhone and phone separately. My normalizer combines them.
        // I will send the combined number in `phone` and the DDI separately.
        ddiPhone: formPayload["Telefones"] ? '55' : null,
        phone: formPayload["Telefones"] ? formPayload["Telefones"].replace(/^55/, '') : null,
        // There are no contact-specific fields in the final API payload example.
        // I will omit them for now to match the documentation.
    };

    // 4. Wrap the final payload in the required structure
    const requestBody = {
        duplicityValidation: true,
        lead: finalApiPayload
    };

    // 5. Use the centralized service to make the API call
    const created = await spotterPost('LeadsAdd', requestBody);

    return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Erro interno no servidor' }, { status: 500 });
  }
}
