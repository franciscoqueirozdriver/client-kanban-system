import { getSheetCached, updateRow } from '../lib/googleSheets.js';

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
    const rowNum = i + 2; // linha real na planilha (considerando cabeçalho)
    const cliente = (data[i][idxOrg] || '').trim();
    if (!cliente) continue;

    const clienteIdAtual = data[i][idxClienteId];
    if (clienteIdAtual && clienteIdAtual.trim()) {
      mapaClientes.set(cliente, clienteIdAtual);
      continue;
    }

    let novoId;
    if (mapaClientes.has(cliente)) {
      novoId = mapaClientes.get(cliente);
    } else {
      novoId = gerarIdSequencial(contador++);
      mapaClientes.set(cliente, novoId);
    }

    // Log de depuração para confirmar geração
    console.log(`Linha ${rowNum}: Cliente="${cliente}" -> ID="${novoId}"`);

    // Atualiza a célula em memória
    data[i][idxClienteId] = novoId;

    // Monta o objeto completo da linha baseado no cabeçalho
    const rowObj = {};
    header.forEach((col, idx) => {
      rowObj[col] = data[i][idx] || '';
    });

    // Força a gravação do Cliente_ID independente do estado anterior
    await updateRow(rowNum, { ...rowObj, Cliente_ID: novoId });
  }

  console.log('✅ IDs de clientes gerados/atualizados com sucesso.');
}

gerarClienteIds().catch(console.error);
