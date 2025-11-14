import { appendRow, updateRow, getSheetData } from '../../lib/googleSheets';
import { SHEETS } from '../../lib/sheets-mapping';

// ✅ Protege números de telefone para salvar como texto no Sheets
function protectPhoneValue(value) {
  if (!value) return '';
  const str = String(value).trim();
  if (/^\+?\d{8,}$/.test(str)) {
    return str.startsWith("'") ? str : `'${str}`;
  }
  return str;
}

function collectEmails(row) {
  const emails = [
    row.pessoa_email_work || '',
    row.pessoa_email_home || '',
    row.pessoa_email_other || '',
  ].map(e => e.trim()).filter(Boolean);

  return Array.from(new Set(emails)).join(';');
}

function normalizePhones(row) {
    const phones = new Set();
    if (row.telefone_normalizado) {
        row.telefone_normalizado.split(';').forEach(p => phones.add(p.trim()));
    }
    // Adicionar outros campos de telefone se necessário
    return Array.from(phones).filter(Boolean);
}


async function groupRows(rows) {
  const filters = {
    segmento: new Set(),
    porte: new Set(),
    uf: new Set(),
    cidade: new Set(),
  };

  const clientesMap = new Map();

  rows.forEach((row) => {
    const clienteId = row.cliente_id || '';
    if (!clienteId) return;

    const company = row.organizacao_nome || row.negocio_organizacao || '';
    const segment = row.organizacao_segmento || '';
    const size = row.organizacao_tamanho_da_empresa || '';
    const uf = row.uf || '';
    const city = row.cidade_estimada || '';
    const status = row.status_kanban || '';
    const dataMov = row.data_ultima_movimentacao || '';
    const color = row.cor_card || '';

    filters.segmento.add(segment);
    filters.porte.add(size);
    filters.uf.add(uf);
    filters.cidade.add(city);

    const contact = {
      name: (row.negocio_pessoa_de_contato || '').trim(),
      role: (row.pessoa_cargo || '').trim(),
      email: collectEmails(row),
      phone: protectPhoneValue(row.pessoa_telefone),
      mobile: protectPhoneValue(row.pessoa_celular),
      normalizedPhones: normalizePhones(row).map(protectPhoneValue),
      linkedin: (row.pessoa_end_linkedin || '').trim(),
    };

    const opportunity = row.negocio_titulo || '';

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
    try {
      const { rows: dataRows } = await getSheetData(SHEETS.SHEET1);
      const { clients, filters } = await groupRows(dataRows);

      const limitParam = parseInt(req.query.limit, 10);
      const limit = Number.isFinite(limitParam) && limitParam >= 0 ? limitParam : clients.length;

      if (req.query.countOnly === '1') {
        return res.status(200).json({ total: clients.length });
      }

      return res.status(200).json({ clients: clients.slice(0, limit), filters });
    } catch (err) {
      console.error('Erro ao listar clientes:', err);
      return res.status(200).json({ clients: [], filters: {} });
    }
  }

  if (req.method === 'POST') {
    try {
      const { row, values } = req.body;

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
    } catch (err) {
      console.error('Erro ao salvar cliente:', err);
      return res.status(500).json({ error: 'Erro ao salvar cliente' });
    }
  }

  return res.status(405).end();
}
