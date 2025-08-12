import { getSheetCached, updateRow, appendHistoryRow } from '../../lib/googleSheets';
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
  const idx = {
    clienteId: header.indexOf('Cliente_ID'),
    org: header.indexOf('Organização - Nome'),
    titulo: header.indexOf('Negócio - Título'),
    contato: header.indexOf('Negócio - Pessoa de contato'),
    cargo: header.indexOf('Pessoa - Cargo'),
    emailWork: header.indexOf('Pessoa - Email - Work'),
    emailHome: header.indexOf('Pessoa - Email - Home'),
    emailOther: header.indexOf('Pessoa - Email - Other'),
    phoneWork: header.indexOf('Pessoa - Phone - Work'),
    phoneHome: header.indexOf('Pessoa - Phone - Home'),
    phoneMobile: header.indexOf('Pessoa - Phone - Mobile'),
    phoneOther: header.indexOf('Pessoa - Phone - Other'),
    tel: header.indexOf('Pessoa - Telefone'),
    cel: header.indexOf('Pessoa - Celular'),
    normalizado: header.indexOf('Telefone Normalizado'),
    segmento: header.indexOf('Organização - Segmento'),
    tamanho: header.indexOf('Organização - Tamanho da empresa'),
    uf: header.indexOf('uf'),
    cidade: header.indexOf('cidade_estimada'),
    status: header.indexOf('Status_Kanban'),
    data: header.indexOf('Data_Ultima_Movimentacao'),
    linkedin: header.indexOf('Pessoa - End. Linkedin'),
    cor: header.indexOf('Cor_Card'),
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
    const { query, segmento, porte, uf, cidade } = req.query;

    const sheet = await getSheetCached();
    const rows = sheet.data.values || [];
    let { clients } = groupRows(rows);

    if (segmento) {
      clients = clients.filter((c) => (c.segment || '').trim().toLowerCase() === segmento.trim().toLowerCase());
    }
    if (porte) {
      const portes = Array.isArray(porte) ? porte : [porte];
      const options = portes.map((p) => p.trim().toLowerCase());
      if (options.length > 0) {
        clients = clients.filter((c) => options.includes((c.size || '').trim().toLowerCase()));
      }
    }
    if (uf) {
      clients = clients.filter((c) => (c.uf || '').trim().toLowerCase() === uf.trim().toLowerCase());
    }
    if (cidade) {
      clients = clients.filter((c) => (c.city || '').trim().toLowerCase() === cidade.trim().toLowerCase());
    }
    if (query) {
      const q = query.toLowerCase();
      clients = clients.filter((client) => {
        const matchName = (client.company || '').toLowerCase().includes(q);
        const matchContact = (client.contacts || []).some((c) =>
          (c.name || c.nome || '').toLowerCase().includes(q)
        );
        const matchOpp = (client.opportunities || []).some((o) =>
          (o || '').toLowerCase().includes(q)
        );
        return matchName || matchContact || matchOpp;
      });
    }

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
    const { id, status, color, source, destination } = req.body;

    const sheet = await getSheetCached();
    const rows = sheet.data.values || [];
    const [header, ...data] = rows;
    const clienteIdIdx = header.indexOf('Cliente_ID');

    const updatePromises = data
      .map((row, i) => {
        if (row[clienteIdIdx] === id) {
          const rowNum = i + 2;
          const values = {
            status_kanban: status,
            cor_card: color,
            data_ultima_movimentacao: new Date().toISOString().split('T')[0],
          };
          return updateRow(rowNum, values);
        }
        return null;
      })
      .filter(Boolean);

    const historyPromise = appendHistoryRow({
      cliente_id: id,
      tipo: 'Mudança de Fase',
      de_fase: source,
      para_fase: destination,
      data_hora: new Date().toISOString(),
    });

    await Promise.all([...updatePromises, historyPromise]);

    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
