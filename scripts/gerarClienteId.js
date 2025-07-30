
const { getSheetCached, updateRow } = require('../lib/googleSheets');

function gerarIdSequencial(numero) {
  return `CLT-${String(numero).padStart(4, '0')}`;
}

async function gerarClienteIds() {
  const res = await getSheetCached();
  const rows = res.data.values || [];
  const [header, ...data] = rows;

  const idxOrg = header.indexOf('Organização - Nome');
  const idxClienteId = header.indexOf('Cliente_ID');

  if (idxOrg === -1) {
    console.error('❌ Coluna "Organização - Nome" não encontrada.');
    return;
  }
  if (idxClienteId === -1) {
    console.error('❌ Coluna "Cliente_ID" não encontrada. Crie a coluna na planilha.');
    return;
  }

  const mapaClientes = new Map();
  let contador = 1;

  for (let i = 0; i < data.length; i++) {
    const rowNum = i + 2; // linha real na planilha
    const cliente = (data[i][idxOrg] || '').trim();
    if (!cliente) continue;

    const clienteIdAtual = data[i][idxClienteId];
    if (clienteIdAtual && clienteIdAtual.trim()) {
      mapaClientes.set(cliente, clienteIdAtual);
      continue;
    }

    // Se cliente já recebeu um ID nesta execução, reaproveita
    if (mapaClientes.has(cliente)) {
      const id = mapaClientes.get(cliente);
      await updateRow(rowNum, { cliente_id: id });
    } else {
      // Gera novo ID e salva
      const novoId = gerarIdSequencial(contador++);
      mapaClientes.set(cliente, novoId);
      await updateRow(rowNum, { cliente_id: novoId });
    }
  }

  console.log('✅ IDs de clientes gerados/atualizados com sucesso.');
}

gerarClienteIds().catch(console.error);
