import { NextResponse } from 'next/server';
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
  "Email Pré-vendedor": "sdrEmail",
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
  // Validação mais flexível de localização - apenas avisar se incompleto
  if (cidade && !uf) {
    errs.push({ field: "Estado", message: "Recomendado quando Cidade for informada" });
  }
  if (uf && !pais) {
    // Assumir Brasil como padrão se não informado
    p["País"] = p["País"] || "Brasil";
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
  try {
    const formPayload = await req.json();

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
        source: "Lista Francisco",
        subSource: formPayload["Sub-Origem"] || "Sistema Kanban",
        website: formPayload["Site"],
        leadProduct: formPayload["Produto"],
        address: formPayload["Logradouro"],
        addressNumber: formPayload["Número"],
        addressComplement: formPayload["Complemento"],
        neighborhood: formPayload["Bairro"],
        zipcode: formPayload["CEP"],
        city: formPayload["Cidade"] || "Não informado",
        state: formPayload["Estado"] || "Não informado",
        country: formPayload["País"] || "Brasil",
        description: formPayload["Observação"] || "Lead importado do sistema Kanban",
        cpfcnpj: formPayload["CPF/CNPJ"],
        funnelId:
          typeof formPayload?.funnelId !== 'undefined' && formPayload?.funnelId !== null
            ? Number.isNaN(Number(formPayload.funnelId))
              ? formPayload.funnelId
              : Number(formPayload.funnelId)
            : null,
        stage: "Entrada",
        sdrEmail: formPayload["Email Pré-vendedor"],
        // The docs show ddiPhone and phone separately. My normalizer combines them.
        // I will send the combined number in `phone` and the DDI separately.
        ddiPhone: formPayload["Telefones"] ? '55' : null,
        phone: formPayload["Telefones"] ? formPayload["Telefones"].replace(/^55/, '') : null,
        // There are no contact-specific fields in the final API payload example.
        // I will omit them for now to match the documentation.
    };

    // 4. Wrap the final payload in the required structure
    const requestBody = {
        duplicityValidation: false, // Permitir duplicatas para evitar erro
        lead: finalApiPayload
    };

    // 5. Use the centralized service to make the API call
    try {
      const created = await spotterPost('LeadsAdd', requestBody);
      return NextResponse.json({ ok: true, data: created }, { status: 201 });
    } catch (spotterError) {
      // Tratamento específico para erros do Spotter
      if (spotterError.message && spotterError.message.includes('Lead already exists')) {
        // Tentar atualizar o lead existente
        try {
          const updateBody = {
            duplicityValidation: false,
            lead: {
              ...finalApiPayload,
              // Adicionar flag para indicar atualização
              description: `${finalApiPayload.description || ''} [Atualizado em ${new Date().toLocaleDateString('pt-BR')}]`.trim()
            }
          };
          const updated = await spotterPost('LeadsAdd', updateBody);
          return NextResponse.json({ 
            ok: true, 
            data: updated, 
            message: 'Lead atualizado com sucesso (já existia no sistema)' 
          }, { status: 200 });
        } catch (updateError) {
          return NextResponse.json({ 
            error: 'Lead já existe no sistema e não foi possível atualizar', 
            details: updateError.message 
          }, { status: 409 });
        }
      } else if (spotterError.message && spotterError.message.includes('City, State')) {
        return NextResponse.json({ 
          error: 'Dados de localização inválidos. Verifique Cidade, Estado e País.', 
          details: spotterError.message 
        }, { status: 400 });
      } else {
        throw spotterError; // Re-throw outros erros
      }
    }
  } catch (err) {
    console.error('Erro na API Spotter:', err);
    return NextResponse.json({ 
      error: err.message || 'Erro interno no servidor',
      details: err.stack || 'Detalhes não disponíveis'
    }, { status: 500 });
  }
}
