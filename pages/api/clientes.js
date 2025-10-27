import { getSheetCached, appendRow, updateRow, getColumnName } from '../../lib/googleSheets';
import { normalizePhones } from '../../lib/report';

// ✅ Protege números de telefone para salvar como texto no Sheets
function protectPhoneValue(value) {
  if (!value) return '';
  const str = String(value).trim();
  if (/^\+?\d{8,}$/.test(str)) {
    return str.startsWith("'") ? str : `'${str}`;
  }
  return str;
}

// ✅ Junta os 3 tipos de e-mail e remove duplicados
function collectEmails(row, idx) {
  const emails = [
    row[idx.emailWork] || '',
    row[idx.emailHome] || '',
    row[idx.emailOther] || '',
  ].map(e => e.trim()).filter(Boolean);

  return Array.from(new Set(emails)).join(';');
}

function groupRows(rows) {
  const [header, ...data] = rows;
  
  // ✅ Usar nomes normalizados para buscar índices
  const clienteIdCol = getColumnName('Cliente_ID');
  const orgCol = getColumnName('Organização - Nome');
  const tituloCol = getColumnName('Negócio - Título');
  const contatoCol = getColumnName('Negócio - Pessoa de contato');
  const cargoCol = getColumnName('Pessoa - Cargo');
  const emailWorkCol = getColumnName('Pessoa - Email - Work');
  const emailHomeCol = getColumnName('Pessoa - Email - Home');
  const emailOtherCol = getColumnName('Pessoa - Email - Other');
  const phoneWorkCol = getColumnName('Pessoa - Phone - Work');
  const phoneHomeCol = getColumnName('Pessoa - Phone - Home');
  const phoneMobileCol = getColumnName('Pessoa - Phone - Mobile');
  const phoneOtherCol = getColumnName('Pessoa - Phone - Other');
  const telCol = getColumnName('Pessoa - Telefone');
  const celCol = getColumnName('Pessoa - Celular');
  const normalizadoCol = getColumnName('Telefone Normalizado');
  const segmentoCol = getColumnName('Organização - Segmento');
  const tamanhoCol = getColumnName('Organização - Tamanho da empresa');
  const ufCol = getColumnName('uf');
  const cidadeCol = getColumnName('cidade_estimada');
  const statusCol = getColumnName('Status_Kanban');
  const dataCol = getColumnName('Data_Ultima_Movimentacao');
  const linkedinCol = getColumnName('Pessoa - End. Linkedin');
  const corCol = getColumnName('Cor_Card');
  
  const idx = {
    clienteId: header.indexOf(clienteIdCol),
    org: header.indexOf(orgCol),
    titulo: header.indexOf(tituloCol),
    contato: header.indexOf(contatoCol),
    cargo: header.indexOf(cargoCol),
    emailWork: header.indexOf(emailWorkCol),
    emailHome: header.indexOf(emailHomeCol),
    emailOther: header.indexOf(emailOtherCol),
    phoneWork: header.indexOf(phoneWorkCol),
    phoneHome: header.indexOf(phoneHomeCol),
    phoneMobile: header.indexOf(phoneMobileCol),
    phoneOther: header.indexOf(phoneOtherCol),
    tel: header.indexOf(telCol),
    cel: header.indexOf(celCol),
    normalizado: header.indexOf(normalizadoCol),
    segmento: header.indexOf(segmentoCol),
    tamanho: header.indexOf(tamanhoCol),
    uf: header.indexOf(ufCol),
    cidade: header.indexOf(cidadeCol),
    status: header.indexOf(statusCol),
    data: header.indexOf(dataCol),
    linkedin: header.indexOf(linkedinCol),
    cor: header.indexOf(corCol),
  };

  const filters = {
    segmento: new Set(),
    porte: new Set(),
    uf: new Set(),
    cidade: new Set(),
  };

  const clientesMap = new Map();

  data.forEach((row) => {
    const clienteId = row[idx.clienteId] || '';
    const company = row[idx.org] || '';
    const segment = row[idx.segmento] || '';
    const size = row[idx.tamanho] || '';
    const uf = row[idx.uf] || '';
    const city = row[idx.cidade] || '';
    const status = row[idx.status] || '';
    const dataMov = row[idx.data] || '';
    const color = row[idx.cor] || '';

    filters.segmento.add(segment);
    filters.porte.add(size);
    filters.uf.add(uf);
    filters.cidade.add(city);

    const contact = {
      name: (row[idx.contato] || '').trim(),
      role: (row[idx.cargo] || '').trim(),
      email: collectEmails(row, idx),
      phone: protectPhoneValue(row[idx.tel]),
      mobile: protectPhoneValue(row[idx.cel]),
      normalizedPhones: normalizePhones(row, idx).map(protectPhoneValue),
      linkedin: (row[idx.linkedin] || '').trim(),
    };

    const opportunity = row[idx.titulo] || '';

    if (clientesMap.has(clienteId)) {
      const existing = clientesMap.get(clienteId);

      if (opportunity && !existing.opportunities.includes(opportunity)) {
        existing.opportunities.push(opportunity);
      }

      const existsContact = existing.contacts.find(
        (c) => c.name === contact.name && c.email === contact.email
      );
      if (!existsContact && (contact.name || contact.email)) {
        existing.contacts.push(contact);
      }
    } else {
      clientesMap.set(clienteId, {
        id: clienteId,
        company,
        opportunities: opportunity ? [opportunity] : [],
        contacts: contact.name || contact.email ? [contact] : [],
        segment,
        size,
        uf,
        city,
        status,
        dataMov,
        color,
      });
    }
  });

  const clients = Array.from(clientesMap.values());

  return {
    clients,
    filters: {
      segmento: Array.from(filters.segmento).sort(),
      porte: Array.from(filters.porte).sort(),
      uf: Array.from(filters.uf).sort(),
      cidade: Array.from(filters.cidade).sort(),
    },
  };
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const sheet = await getSheetCached();
    const rows = sheet.data.values || [];
    const { clients, filters } = groupRows(rows);
    return res.status(200).json({ clients, filters });
  }

  if (req.method === 'POST') {
    const { row, values } = req.body;

    // ✅ Protege telefones antes de salvar
    if (values?.telefone_normalizado) {
      values.telefone_normalizado = values.telefone_normalizado
        .split(';')
        .map(protectPhoneValue)
        .join(';');
    }
    if (values?.tel) values.tel = protectPhoneValue(values.tel);
    if (values?.cel) values.cel = protectPhoneValue(values.cel);

    if (row) {
      await updateRow(row, values);
    } else {
      await appendRow(values);
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}

