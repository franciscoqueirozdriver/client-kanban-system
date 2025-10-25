import { getSheetCached, updateRow, getColumnName } from '../../lib/googleSheets';
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
      id: c.id,
      company: c.company,
      opportunities: Array.from(new Set(c.opportunities)),
      contacts: Array.from(c.contactsMap.values()),
      segment: c.segment,
      size: c.size,
      uf: c.uf,
      city: c.city,
      status: c.status,
      dataMov: c.dataMov,
      color: c.color,
      rows: c.rows,
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

    // ✅ Usar nomes normalizados para buscar índices
    const clienteIdCol = getColumnName('Cliente_ID');
    const corCol = getColumnName('Cor_Card');
    const statusCol = getColumnName('Status_Kanban');

    const clienteIdIdx = header.indexOf(clienteIdCol);
    const colorIdx = header.indexOf(corCol);
    const statusIdx = header.indexOf(statusCol);

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

