import { getSheetCached, appendRow, updateRow } from '@/lib/googleSheets';
import { mapClienteRow } from '@/lib/mappers/sheetsToDomain';
import { Cliente } from '@/types/cliente';

function groupRows(rows: Record<string, unknown>[]): { clients: Cliente[], filters: any } {
  const clientesMap = new Map<string, Cliente>();
  const filters = {
    segmento: new Set<string>(),
    porte: new Set<string>(),
    uf: new Set<string>(),
    cidade: new Set<string>(),
  };

  rows.forEach((row) => {
    const cliente = mapClienteRow(row) as Cliente;
    if (!cliente.cliente_id || !cliente.nome_da_empresa) {
      return;
    }

    filters.segmento.add(cliente.organizacao_segmento);
    filters.porte.add(cliente.organizacao_tamanho_da_empresa);

    if (clientesMap.has(cliente.cliente_id)) {
      const existing = clientesMap.get(cliente.cliente_id)!;
      // You can add logic here to merge opportunities, contacts, etc. if needed.
    } else {
      clientesMap.set(cliente.cliente_id, cliente);
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


export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      const sheet = await getSheetCached('sheet1');
      if (!sheet || !sheet.data || !sheet.data.values) {
        throw new Error('Falha ao obter dados da planilha ou dados vazios.');
      }
      const [header, ...data] = sheet.data.values;
      const rows = data.map((row: any[]) => {
        const rowData: Record<string, unknown> = {};
        header.forEach((key: string, index: number) => {
            rowData[key] = row[index];
        });
        return rowData;
      });

      const { clients, filters } = groupRows(rows);

      const limitParam = parseInt(req.query.limit, 10);
      const limit = Number.isFinite(limitParam) && limitParam >= 0 ? limitParam : clients.length;

      if (req.query.countOnly === '1') {
        return res.status(200).json({ total: clients.length });
      }

      return res.status(200).json({ clients: clients.slice(0, limit), filters });
    } catch (err) {
      console.error('Erro ao listar clientes:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      return res.status(500).json({ error: 'Erro ao listar clientes', details: errorMessage });
    }
  }

  if (req.method === 'POST') {
    try {
      const { row, values } = req.body;
      if (row) {
        await updateRow('sheet1', row, values);
      } else {
        await appendRow(values);
      }
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('Erro ao salvar cliente:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      return res.status(500).json({ error: 'Erro ao salvar cliente', details: errorMessage });
    }
  }

  return res.status(405).end();
}
