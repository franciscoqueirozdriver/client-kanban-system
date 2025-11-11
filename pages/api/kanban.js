import { getSheet, getSheetCached, findRowIndexById, updateRowByIndex } from '../../lib/googleSheets';
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
  if (!rows || rows.length === 0) {
    return { clients: [] };
  }
  const [header, ...data] = rows;
  const idx = {
    clienteId: header.indexOf('cliente_id'),
    org: header.indexOf('organizacao_nome'),
    titulo: header.indexOf('negocio_titulo'),
    contato: header.indexOf('negocio_pessoa_de_contato'),
    cargo: header.indexOf('pessoa_cargo'),
    emailWork: header.indexOf('pessoa_email_work'),
    emailHome: header.indexOf('pessoa_email_home'),
    emailOther: header.indexOf('pessoa_email_other'),
    phoneWork: header.indexOf('pessoa_phone_work'),
    phoneHome: header.indexOf('pessoa_phone_home'),
    phoneMobile: header.indexOf('pessoa_phone_mobile'),
    phoneOther: header.indexOf('pessoa_phone_other'),
    tel: header.indexOf('pessoa_telefone'),
    cel: header.indexOf('pessoa_celular'),
    normalizado: header.indexOf('telefone_normalizado'),
    segmento: header.indexOf('organizacao_segmento'),
    tamanho: header.indexOf('organizacao_tamanho_da_empresa'),
    uf: header.indexOf('uf'),
    cidade: header.indexOf('cidade_estimada'),
    status: header.indexOf('status_kanban'),
    data: header.indexOf('data_ultima_movimentacao'),
    linkedin: header.indexOf('pessoa_end_linkedin'),
    cor: header.indexOf('cor_card'),
    produto: header.indexOf('negocio_nome_do_produto'),
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
        status: '', // Will be overwritten by the latest row
        dataMov: '', // Will be overwritten by the latest row
        color: '', // Will be overwritten by the latest row
        produto: row[idx.produto] || '',
        rows: [],
      });
    }

    // Always update status and color to reflect the latest row for a given ID
    const client = map.get(clienteId);
    const newStatus = (row[idx.status] || '').trim();
    const newColor = row[idx.cor] || '';
    const newDataMov = row[idx.data] || '';

    if (newStatus) client.status = newStatus;
    if (newColor) client.color = newColor;
    if (newDataMov) client.dataMov = newDataMov;

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
      produto: c.produto,
      rows: c.rows,
    })),
  };
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const sheet = await getSheet();
      const rows = sheet && sheet.data ? sheet.data.values || [] : [];
      const { clients } = groupRows(rows);

      const limitParam = parseInt(req.query.limit, 10);
      const limit = Number.isFinite(limitParam) && limitParam >= 0 ? limitParam : clients.length;

      const columns = [
        'Lead Selecionado',
        'Tentativa de Contato',
        'Contato Efetuado',
        'Conversa Iniciada',
        'Reunião Agendada',
        'Enviado Spotter',
        'Perdido',
      ];
      const board = columns.map((col) => ({ id: col, title: col, cards: [] }));

      clients.slice(0, limit).forEach((client) => {
        const col = board.find((c) => c.id === client.status);
        if (col) {
          col.cards.push({ id: client.id, client });
        }
      });

      return res.status(200).json(board);
    } catch (err) {
      console.error('Erro ao listar kanban:', err);
      return res.status(500).json({ error: 'Erro ao listar kanban' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { id, destination, status, color } = req.body;
      const newStatus = status || (destination && destination.droppableId);
      const newColor =
        color !== undefined
          ? color
          : newStatus === 'Perdido'
          ? 'red'
          : undefined;

      const sheetName = 'sheet1';
      const rowIndex = await findRowIndexById(sheetName, 1, 'cliente_id', id);
      if (rowIndex < 0) {
        return res.status(404).json({ error: 'ID não encontrado' });
      }

      const updates = {};
      if (newStatus !== undefined) {
        updates['status_kanban'] = newStatus;
      }
      if (newColor !== undefined) {
        updates['cor_card'] = newColor;
      }
      updates['data_ultima_movimentacao'] = new Date().toISOString().split('T')[0];

      await updateRowByIndex({ sheetName, rowIndex, updates });

      return res.status(200).json({ status: newStatus, color: newColor });
    } catch (err) {
      console.error('Erro ao atualizar kanban:', err);
      const statusCode = err?.response?.status || err?.code || 500;
      return res.status(statusCode).json({ error: err.message || 'Erro ao atualizar kanban' });
    }
  }

  return res.status(405).end();
}
