// pages/api/perdcomp/dicionario.js - API para gerenciar dicionário PER/DCOMP

import { getSheet } from '../../../lib/googleSheets';

// Função para obter coluna como mapa (chave -> linha)
async function getColAsMap(sheetName, colA1 = 'A') {
  const sheet = await getSheet();
  const range = `${sheetName}!${colA1}:${colA1}`;
  
  try {
    const response = await sheet.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range,
    });
    
    const map = new Map();
    const values = response.data.values || [];
    values.forEach((row, index) => {
      const key = row?.[0];
      if (key) {
        map.set(String(key), index + 1);
      }
    });
    
    return map;
  } catch (error) {
    console.error(`Erro ao obter coluna ${colA1} da aba ${sheetName}:`, error);
    return new Map();
  }
}

// Função para timestamp ISO
function nowISO() {
  return new Date().toISOString();
}

// Upsert de tipos de documento
async function upsertTipos(exemploPerdcomp, tipoFromAPI) {
  const sheet = await getSheet();
  const map = await getColAsMap('DIC_TIPOS', 'A');
  
  const tipos = [
    { codigo: 1, nome: 'DCOMP', desc: 'Declaração de Compensação' },
    { codigo: 2, nome: 'REST', desc: 'Pedido de Restituição' },
    { codigo: 8, nome: 'CANC', desc: 'Pedido de Cancelamento' },
  ];
  
  const updates = [];
  const inserts = [];
  
  for (const tipo of tipos) {
    const key = `TIPO:${tipo.codigo}`;
    const row = [
      key,
      '4',
      String(tipo.codigo),
      tipo.nome,
      tipo.desc,
      'Receita/consultas',
      exemploPerdcomp,
      nowISO()
    ];
    
    if (map.has(key)) {
      updates.push({
        range: `DIC_TIPOS!A${map.get(key)}:H${map.get(key)}`,
        values: [row]
      });
    } else {
      inserts.push(row);
    }
  }
  
  // Executar updates
  if (updates.length > 0) {
    await sheet.spreadsheets.values.batchUpdate({
      spreadsheetId: process.env.SPREADSHEET_ID,
      requestBody: {
        valueInputOption: 'RAW',
        data: updates
      }
    });
  }
  
  // Executar inserts
  if (inserts.length > 0) {
    await sheet.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: 'DIC_TIPOS!A:H',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: inserts
      }
    });
  }
}

// Upsert de naturezas
async function upsertNatureza(codigoNat, exemploPerdcomp, fromAPI = {}) {
  const sheet = await getSheet();
  const map = await getColAsMap('DIC_NATUREZAS', 'A');
  
  const naturezaFamilias = {
    '1.0': 'DCOMP',
    '1.1': 'RESSARC',
    '1.2': 'REST',
    '1.3': 'DCOMP',
    '1.5': 'RESSARC',
    '1.6': 'REST',
    '1.7': 'DCOMP',
    '1.8': 'CANC',
    '1.9': 'DCOMP',
  };
  
  const naturezaObs = {
    '1.0': 'Ressarcimento de IPI',
    '1.1': 'Pedido de Ressarcimento (genérico)',
    '1.2': 'Pedido de Restituição',
    '1.3': 'Declaração de Compensação (geral)',
    '1.5': 'Pedido de Ressarcimento (IPI, etc.)',
    '1.6': 'Pedido de Restituição',
    '1.7': 'Declaração de Compensação',
    '1.8': 'Pedido de Cancelamento',
    '1.9': 'Cofins Não-Cumulativa – Ressarcimento/Compensação',
  };
  
  const familia = naturezaFamilias[codigoNat] || 'DESCONHECIDO';
  const nomeMap = {
    'DCOMP': 'Declaração de Compensação',
    'REST': 'Pedido de Restituição',
    'RESSARC': 'Pedido de Ressarcimento',
    'CANC': 'Pedido de Cancelamento',
    'DESCONHECIDO': 'Não mapeado'
  };
  const nome = nomeMap[familia];
  const obs = naturezaObs[codigoNat] || fromAPI.tipo_credito || '';
  
  const key = `NAT:${codigoNat}`;
  const row = [
    key,
    '5',
    codigoNat,
    familia,
    nome,
    obs,
    'Receita/consultas',
    exemploPerdcomp,
    nowISO()
  ];
  
  if (map.has(key)) {
    await sheet.spreadsheets.values.update({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: `DIC_NATUREZAS!A${map.get(key)}:I${map.get(key)}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [row]
      }
    });
  } else {
    await sheet.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: 'DIC_NATUREZAS!A:I',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [row]
      }
    });
  }
}

// Upsert de créditos
async function upsertCredito(codCred, exemploPerdcomp, descFromAPI) {
  const sheet = await getSheet();
  const map = await getColAsMap('DIC_CREDITOS', 'A');
  
  const creditosDesc = {
    '01': 'Ressarcimento de IPI',
    '02': 'Saldo Negativo de IRPJ',
    '03': 'Outros Créditos',
    '04': 'Pagamento indevido ou a maior',
    '15': 'Retenção – Lei nº 9.711/98',
    '16': 'Outros Créditos (Cancelamento)',
    '17': 'Reintegra',
    '18': 'Outros Créditos',
    '19': 'Cofins Não-Cumulativa – Ressarcimento/Compensação',
    '24': 'Pagamento Indevido ou a Maior (eSocial)',
    '25': 'Outros Créditos',
    '57': 'Outros Créditos',
  };
  
  const desc = creditosDesc[codCred] || descFromAPI || 'Não identificado';
  
  const key = `CRED:${codCred}`;
  const row = [
    key,
    '6',
    codCred,
    desc,
    'Receita/consultas',
    exemploPerdcomp,
    nowISO()
  ];
  
  if (map.has(key)) {
    await sheet.spreadsheets.values.update({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: `DIC_CREDITOS!A${map.get(key)}:G${map.get(key)}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [row]
      }
    });
  } else {
    await sheet.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: 'DIC_CREDITOS!A:G',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [row]
      }
    });
  }
}

// Processar retorno da API
async function processarRetornoAPI(items) {
  const { parsePerdcomp } = await import('../../../lib/perdcomp');
  
  for (const item of items) {
    const parsed = parsePerdcomp(item.perdcomp);
    if (!parsed.valido) continue;
    
    try {
      // Atualizar dicionários
      await upsertTipos(item.perdcomp, item.tipo_documento);
      await upsertNatureza(parsed.natureza, item.perdcomp, {
        tipo_documento: item.tipo_documento,
        tipo_credito: item.tipo_credito
      });
      await upsertCredito(parsed.credito, item.perdcomp, item.tipo_credito);
      
      console.log(`Processado PER/DCOMP: ${item.perdcomp}`);
    } catch (error) {
      console.error(`Erro ao processar ${item.perdcomp}:`, error);
    }
  }
}

// Handler principal da API
export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { items } = req.body;
      
      if (!items || !Array.isArray(items)) {
        return res.status(400).json({ error: 'Items array é obrigatório' });
      }
      
      await processarRetornoAPI(items);
      
      return res.status(200).json({ 
        success: true, 
        message: `${items.length} itens processados com sucesso`,
        processados: items.length
      });
      
    } catch (error) {
      console.error('Erro ao processar dicionário PER/DCOMP:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
  
  if (req.method === 'GET') {
    try {
      const sheet = await getSheet();
      
      // Buscar dados dos dicionários
      const [tipos, naturezas, creditos] = await Promise.all([
        sheet.spreadsheets.values.get({
          spreadsheetId: process.env.SPREADSHEET_ID,
          range: 'DIC_TIPOS!A:H'
        }).catch(() => ({ data: { values: [] } })),
        
        sheet.spreadsheets.values.get({
          spreadsheetId: process.env.SPREADSHEET_ID,
          range: 'DIC_NATUREZAS!A:I'
        }).catch(() => ({ data: { values: [] } })),
        
        sheet.spreadsheets.values.get({
          spreadsheetId: process.env.SPREADSHEET_ID,
          range: 'DIC_CREDITOS!A:G'
        }).catch(() => ({ data: { values: [] } }))
      ]);
      
      return res.status(200).json({
        tipos: tipos.data.values || [],
        naturezas: naturezas.data.values || [],
        creditos: creditos.data.values || []
      });
      
    } catch (error) {
      console.error('Erro ao buscar dicionários:', error);
      return res.status(500).json({ error: 'Erro ao buscar dados dos dicionários' });
    }
  }
  
  return res.status(405).json({ error: 'Método não permitido' });
}
