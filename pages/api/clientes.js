import { getSheetData, appendRow, updateRow } from '../../lib/googleSheets';

function normalizeClient(row) {
  const get = (key, fallback = '') => row[key] || fallback;

  return {
    id: get('cliente_id') || get('Cliente_ID'),
    company: get('nome_da_empresa') || get('Organização - Nome'),
    segment: get('segmento') || get('Organização - Segmento'),
    size: get('tamanho_da_empresa') || get('Organização - Tamanho da empresa'),
    uf: get('uf'),
    city: get('cidade_estimada'),
    status: get('status_kanban') || get('Status_Kanban'),
    dataMov: get('data_ultima_movimentacao') || get('Data_Ultima_Movimentacao'),
    color: get('cor_card') || get('Cor_Card'),
    // Add other fields as needed
  };
}

function groupRows(rows) {
  const filters = {
    segmento: new Set(),
    porte: new Set(),
    uf: new Set(),
    cidade: new Set(),
  };

  const clientesMap = new Map();

  rows.forEach((row) => {
    const client = normalizeClient(row);

    filters.segmento.add(client.segment);
    filters.porte.add(client.size);
    filters.uf.add(client.uf);
    filters.cidade.add(client.city);

    if (clientesMap.has(client.id)) {
      // Handle existing client logic if necessary
    } else {
      clientesMap.set(client.id, client);
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
      const { rows } = await getSheetData('sheet1');
      const { clients, filters } = groupRows(rows);

      const limitParam = parseInt(req.query.limit, 10);
      const limit = Number.isFinite(limitParam) && limitParam >= 0 ? limitParam : clients.length;

      if (req.query.countOnly === '1') {
        return res.status(200).json({ total: clients.length });
      }

      return res.status(200).json({ clients: clients.slice(0, limit), filters });
    } catch (err) {
      console.error('Erro ao listar clientes:', err);
      // Return empty structure on failure
      return res.status(200).json({ clients: [], filters: {} });
    }
  }

  if (req.method === 'POST') {
    try {
      const { row, values } = req.body;
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
