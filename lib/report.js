import { batchUpdateRows } from './googleSheets';
import { aggregateClientData } from './dataUtils';

export async function buildReport(rows, { savePhones = true } = {}) {
  if (!rows || rows.length < 2) {
    return { map: new Map(), filters: {} };
  }

  const { clientMap, filters } = aggregateClientData(rows);

  if (savePhones) {
    const phoneUpdates = [];
    const header = rows[0];
    const normalizedPhoneIndex = header.indexOf('Telefone Normalizado');

    // Itera sobre os dados originais para verificar se o telefone normalizado precisa ser salvo.
    // Isso é necessário porque o clientMap não contém a informação se a célula original estava vazia.
    const dataRows = rows.slice(1);
    const clientDataById = new Map(Array.from(clientMap.values()).map(c => [c.id, c]));

    dataRows.forEach((row, i) => {
      const clienteId = row[header.indexOf('Cliente_ID')];
      if (!clienteId) return;

      const client = clientDataById.get(clienteId);
      if (!client) return;

      const hasOriginalNormalized = row[normalizedPhoneIndex] && String(row[normalizedPhoneIndex]).trim() !== '';

      // Encontra o primeiro contato com telefones normalizados para este cliente.
      const contactWithPhones = client.contacts.find(c => c.normalizedPhones.length > 0);

      if (!hasOriginalNormalized && contactWithPhones) {
        const value = contactWithPhones.normalizedPhones.join(';');
        // Adiciona a atualização para a primeira linha associada a este cliente.
        // A lógica assume que salvar em qualquer uma das linhas do cliente é suficiente.
        const rowNum = client.rows[0];

        // Evita adicionar duplicados no array de updates.
        if (!phoneUpdates.some(upd => upd.rowNumber === rowNum)) {
             phoneUpdates.push({
                rowNumber: rowNum,
                data: { telefone_normalizado: value },
             });
        }
      }
    });

    if (phoneUpdates.length) {
      await batchUpdateRows(phoneUpdates).catch((err) => {
        console.error('Erro ao salvar telefones normalizados em lote', { err });
      });
    }
  }

  console.log('buildReport:', {
    linhasProcessadas: rows.length - 1,
    clientes: clientMap.size,
  });

  return { map: clientMap, filters };
}

export function mapToRows(map, query = {}, max = Infinity, onlyNew = true) {
  const result = [];
  const toMark = new Set();
  const seen = new Set();

  map.forEach((item) => {
    if (query.segmento && item.segment !== query.segmento) return;
    if (query.porte) {
      const selected = Array.isArray(query.porte)
        ? query.porte
        : query.porte.split(',');
      if (!selected.includes(item.size)) return;
    }
    if (query.uf && item.uf !== query.uf) return;
    if (query.cidade && item.cidade !== query.cidade) return;
    if (result.length >= max) return;

    const contatos = item.contacts.length === 0
      ? [{
          nome: '',
          cargo: '',
          telefone: '',
          celular: '',
          email: '',
          linkedin: '',
          impresso: '',
        }]
      : item.contacts;

    contatos.forEach((c) => {
      if (result.length >= max) return;
      if (onlyNew && c.impresso === 'Em Lista') return;

      const key = `${item.id}|${c.nome}|${c.telefone}|${c.celular}|${c.email}|${c.linkedin}|${(c.normalizedPhones || []).join(',')}`;
      if (seen.has(key)) return;
      seen.add(key);

      result.push({
        id: item.id,
        company: item.company,
        segment: item.segment,
        size: item.size,
        nome: c.nome,
        cargo: c.cargo,
        telefone: c.telefone,
        celular: c.celular,
        email: c.email,
        linkedin: c.linkedin,
        normalizedPhones: c.normalizedPhones || [],
      });

      item.rows.forEach((r) => toMark.add(r));
    });
  });

  console.log('mapToRows:', {
    totalSelecionados: result.length,
    marcar: Array.from(toMark).length,
  });

  return { rows: result, toMark };
}

export async function markPrintedRows(rows) {
  const updates = Array.from(rows).map((rowNum) => ({
    rowNumber: rowNum,
    data: { impresso_lista: 'Em Lista' },
  }));
  await batchUpdateRows(updates);
}
