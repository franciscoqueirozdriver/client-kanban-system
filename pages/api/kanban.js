import { getSheetCached, updateRow } from '../../lib/googleSheets';
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
  ]
    .map((e) => String(e).trim())
    .filter(Boolean);

  return Array.from(new Set(emails)).join(';');
}

function groupRows(rows) {
  const [header, ...data] = rows;
  const lowerHeader = header.map((h) => (h ? h.toLowerCase() : ''));
  const idx = {
    clienteId: lowerHeader.indexOf('cliente_id'),
    org: lowerHeader.indexOf('organização - nome'),
    titulo: lowerHeader.indexOf('negócio - título'),
    contato: lowerHeader.indexOf('negócio - pessoa de contato'),
    cargo: lowerHeader.indexOf('pessoa - cargo'),
    emailWork: lowerHeader.indexOf('pessoa - email - work'),
    emailHome: lowerHeader.indexOf('pessoa - email - home'),
    emailOther: lowerHeader.indexOf('pessoa - email - other'),
    phoneWork: lowerHeader.indexOf('pessoa - phone - work'),
    phoneHome: lowerHeader.indexOf('pessoa - phone - home'),
    phoneMobile: lowerHeader.indexOf('pessoa - phone - mobile'),
    phoneOther: lowerHeader.indexOf('pessoa - phone - other'),
    tel: lowerHeader.indexOf('pessoa - telefone'),
    cel: lowerHeader.indexOf('pessoa - celular'),
    normalizado: lowerHeader.indexOf('telefone normalizado'),
    segmento: lowerHeader.indexOf('organização - segmento'),
    tamanho: lowerHeader.indexOf('organização - tamanho da empresa'),
    uf: lowerHeader.indexOf('uf'),
    cidade: lowerHeader.indexOf('cidade_estimada'),
    status: lowerHeader.indexOf('status_kanban'),
    data: lowerHeader.indexOf('data_ultima_movimentacao'),
    linkedin: lowerHeader.indexOf('pessoa - end. linkedin'),
    cor: lowerHeader.indexOf('cor_card'),
    // Detalhes da empresa para registro
    website: lowerHeader.indexOf('site'),
    country: lowerHeader.indexOf('país'),
    state: lowerHeader.indexOf('estado'),
    address: lowerHeader.indexOf('logradouro'),
    number: lowerHeader.indexOf('número'),
    neighborhood: lowerHeader.indexOf('bairro'),
    complement: lowerHeader.indexOf('complemento'),
    zipcode: lowerHeader.indexOf('cep'),
    cnpj: lowerHeader.indexOf('cnpj'),
    observation: lowerHeader.indexOf('observação'),
    ddi: lowerHeader.indexOf('ddi'),
  };

  const map = new Map();

  data.forEach((row, i) => {
    const clienteId = row[idx.clienteId];
    if (!clienteId) return;

    if (!map.has(clienteId)) {
      map.set(clienteId, {
        id: clienteId,
        company: row[idx.org] || '',
        opportunities: [],
        contactsMap: new Map(),
        segment: row[idx.segmento] || '',
        size: row[idx.tamanho] || '',
        uf: row[idx.uf] || '',
        city: row[idx.cidade] || '',
        status: row[idx.status] || '',
        dataMov: row[idx.data] || '',
        color: row[idx.cor] || '',
        rows: [],
        // Detalhes da empresa
        website: row[idx.website] || '',
        country: row[idx.country] || '',
        state: row[idx.state] || '',
        address: row[idx.address] || '',
        number: row[idx.number] || '',
        neighborhood: row[idx.neighborhood] || '',
        complement: row[idx.complement] || '',
        zipcode: row[idx.zipcode] || '',
        cnpj: row[idx.cnpj] || '',
        observation: row[idx.observation] || '',
        ddi: row[idx.ddi] || '',
      });
    }

    const client = map.get(clienteId);
    client.opportunities.push(row[idx.titulo] || '');
    client.rows.push(i + 2);

    const contactName = (row[idx.contato] || '').trim();
    const allEmails = collectEmails(row, idx);
    const key = `${contactName}|${allEmails}`;

    if (!client.contactsMap.has(key)) {
      const normalized = normalizePhones(row, idx).map(protectPhoneValue);
      client.contactsMap.set(key, {
        name: contactName,
        role: (row[idx.cargo] || '').trim(),
        email: allEmails,
        phone: protectPhoneValue(row[idx.tel]),
        mobile: protectPhoneValue(row[idx.cel]),
        normalizedPhones: normalized,
        linkedin: (row[idx.linkedin] || '').trim(),
      });
    }
  });

  return {
    clients: Array.from(map.values()).map((c) => ({
      ...c, // Inclui todos os campos do objeto do map
      opportunities: Array.from(new Set(c.opportunities)),
      contacts: Array.from(c.contactsMap.values()),
    })),
  };
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const sheet = await getSheetCached();
    const rows = sheet.data.values || [];
    const { clients } = groupRows(rows);

    const columns = [
      'Lead Selecionado',
      'Tentativa de Contato',
      'Contato Efetuado',
      'Conversa Iniciada',
      'Reunião Agendada',
      'Perdido',
    ];
    const board = columns.map((col) => ({ id: col, title: col, cards: [] }));

    clients.forEach((client) => {
      const col = board.find((c) => c.id === client.status);
      if (col) {
        col.cards.push({ id: client.id, client });
      }
    });

    return res.status(200).json(board);
  }

  if (req.method === 'POST') {
    const { id, destination, status, color } = req.body;
    const newStatus = status || (destination && destination.droppableId);
    const newColor =
      color !== undefined
        ? color
        : newStatus === 'Perdido'
        ? 'red'
        : undefined;

    const sheet = await getSheetCached();
    const rows = sheet.data.values || [];
    const [header, ...data] = rows;

    const clienteIdIdx = header.indexOf('Cliente_ID');
    const colorIdx = header.indexOf('Cor_Card');
    const statusIdx = header.indexOf('Status_Kanban');

    const promises = [];

    data.forEach((row, i) => {
      if (row[clienteIdIdx] === id) {
        const rowNum = i + 2;
        const values = {};
        if (newStatus !== undefined && statusIdx !== -1) {
          values.status_kanban = newStatus;
        }
        if (newColor !== undefined && colorIdx !== -1) {
          values.cor_card = newColor;
        }
        values.data_ultima_movimentacao = new Date().toISOString().split('T')[0];
        promises.push(updateRow(rowNum, values));
      }
    });

    await Promise.all(promises);
    return res.status(200).json({ status: newStatus, color: newColor });
  }

  return res.status(405).end();
}
