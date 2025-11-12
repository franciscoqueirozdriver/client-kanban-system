import { GoogleSpreadsheet } from 'google-spreadsheet';
import { buildColumnResolver } from '../../lib/sheets/headerResolver';
import { JWT } from 'google-auth-library';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

const serviceAccountAuth = new JWT({
  email: GOOGLE_CLIENT_EMAIL,
  key: GOOGLE_PRIVATE_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function getTeseSheet() {
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
  await doc.loadInfo();
  
  // Procurar pela aba de teses (pode ter nomes diferentes)
  let sheet = doc.sheetsByTitle['Teses'] || 
             doc.sheetsByTitle['TESES'] || 
             doc.sheetsByTitle['teses'] ||
             doc.sheetsByIndex[0]; // fallback para primeira aba
  
  return sheet;
}

function generateTeseId(existingTeses) {
  const prefix = 'HABPISCOFINS_';
  const existingNumbers = existingTeses
    .map(tese => tese.Tese_ID)
    .filter(id => id && id.startsWith(prefix))
    .map(id => parseInt(id.replace(prefix, ''), 10))
    .filter(num => !isNaN(num));
  
  const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
  const nextNumber = maxNumber + 1;
  
  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
}

export default async function handler(req, res) {
  try {
    const sheet = await getTeseSheet();
    
    if (req.method === 'GET') {
      await sheet.loadHeaderRow();
      const COL = await buildColumnResolver('Teses');
      const rows = await sheet.getRows();
      
      const teses = rows.map(row => ({
        id: row.rowNumber,
        Tese_ID: row.get(COL('Tese_ID')) || '',
        Tipo: row.get(COL('Tipo')) || '',
        Tema: row.get(COL('Tema')) || '',
        'Tributo do Crédito': row.get(COL('Tributo do Crédito')) || '',
        'Base Legal': row.get(COL('Base Legal')) || '',
        'Contexto do Direito': row.get(COL('Contexto do Direito')) || '',
        'Documentação Necessária': row.get(COL('Documentação Necessária')) || '',
        'Informações a Serem Analisadas': row.get(COL('Informações a Serem Analisadas')) || '',
        'Forma de Utilização': row.get(COL('Forma de Utilização')) || '',
        'Público-Alvo': row.get(COL('Público-Alvo')) || '',
        'Grau de Risco': row.get(COL('Grau de Risco')) || '',
        Status: row.get(COL('Status')) || 'Ativa'
      }));
      
      return res.status(200).json({ teses });
    }
    
    if (req.method === 'POST') {
      const { action, teseData, teseId } = req.body;
      
      if (action === 'create') {
        await sheet.loadHeaderRow();
        const COL = await buildColumnResolver('Teses');
        const rows = await sheet.getRows();
        
        const existingTeses = rows.map(row => ({
          Tese_ID: row.get(COL('Tese_ID')) || ''
        }));
        
        const newTeseId = generateTeseId(existingTeses);
        
        const newRow = await sheet.addRow({
          [COL('Tese_ID')]: newTeseId,
          [COL('Tipo')]: teseData.tipo || '',
          [COL('Tema')]: teseData.tema || '',
          [COL('Tributo do Crédito')]: teseData.tributo || '',
          [COL('Base Legal')]: teseData.baseLegal || '',
          [COL('Contexto do Direito')]: teseData.contexto || '',
          [COL('Documentação Necessária')]: teseData.documentacao || '',
          [COL('Informações a Serem Analisadas')]: teseData.informacoes || '',
          [COL('Forma de Utilização')]: teseData.formaUtilizacao || '',
          [COL('Público-Alvo')]: teseData.publicoAlvo || '',
          [COL('Grau de Risco')]: teseData.grauRisco || 'Remoto',
          [COL('Status')]: 'Ativa'
        });
        
        return res.status(201).json({ 
          success: true, 
          teseId: newTeseId,
          message: 'Tese criada com sucesso' 
        });
      }
      
      if (action === 'updateStatus') {
        await sheet.loadHeaderRow();
        const COL = await buildColumnResolver('Teses');
        const rows = await sheet.getRows();
        
        const targetRow = rows.find(row => row.get(COL('Tese_ID')) === teseId);
        if (!targetRow) {
          return res.status(404).json({ error: 'Tese não encontrada' });
        }
        
        const currentStatus = targetRow.get(COL('Status'));
        const newStatus = currentStatus === 'Ativa' ? 'Inativa' : 'Ativa';
        
        targetRow.set(COL('Status'), newStatus);
        await targetRow.save();
        
        return res.status(200).json({ 
          success: true, 
          newStatus,
          message: `Tese ${newStatus.toLowerCase()} com sucesso` 
        });
      }
    }
    
    if (req.method === 'PUT') {
      const { teseId, teseData } = req.body;
      
      await sheet.loadHeaderRow();
      const COL = await buildColumnResolver('Teses');
      const rows = await sheet.getRows();
      
      const targetRow = rows.find(row => row.get(COL('Tese_ID')) === teseId);
      if (!targetRow) {
        return res.status(404).json({ error: 'Tese não encontrada' });
      }
      
      // Atualizar campos
      if (teseData.tipo !== undefined) targetRow.set(COL('Tipo'), teseData.tipo);
      if (teseData.tema !== undefined) targetRow.set(COL('Tema'), teseData.tema);
      if (teseData.tributo !== undefined) targetRow.set(COL('Tributo do Crédito'), teseData.tributo);
      if (teseData.baseLegal !== undefined) targetRow.set(COL('Base Legal'), teseData.baseLegal);
      if (teseData.contexto !== undefined) targetRow.set(COL('Contexto do Direito'), teseData.contexto);
      if (teseData.documentacao !== undefined) targetRow.set(COL('Documentação Necessária'), teseData.documentacao);
      if (teseData.informacoes !== undefined) targetRow.set(COL('Informações a Serem Analisadas'), teseData.informacoes);
      if (teseData.formaUtilizacao !== undefined) targetRow.set(COL('Forma de Utilização'), teseData.formaUtilizacao);
      if (teseData.publicoAlvo !== undefined) targetRow.set(COL('Público-Alvo'), teseData.publicoAlvo);
      if (teseData.grauRisco !== undefined) targetRow.set(COL('Grau de Risco'), teseData.grauRisco);
      
      await targetRow.save();
      
      return res.status(200).json({ 
        success: true, 
        message: 'Tese atualizada com sucesso' 
      });
    }
    
    return res.status(405).json({ error: 'Método não permitido' });
    
  } catch (error) {
    console.error('Erro na API de teses:', error);
    return res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error.message 
    });
  }
}
