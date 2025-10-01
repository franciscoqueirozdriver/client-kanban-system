import { GoogleSpreadsheet } from 'google-spreadsheet';
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
      const rows = await sheet.getRows();
      
      const teses = rows.map(row => ({
        id: row.rowNumber,
        Tese_ID: row.get('Tese_ID') || '',
        Tipo: row.get('Tipo') || '',
        Tema: row.get('Tema') || '',
        'Tributo do Crédito': row.get('Tributo do Crédito') || '',
        'Base Legal': row.get('Base Legal') || '',
        'Contexto do Direito': row.get('Contexto do Direito') || '',
        'Documentação Necessária': row.get('Documentação Necessária') || '',
        'Informações a Serem Analisadas': row.get('Informações a Serem Analisadas') || '',
        'Forma de Utilização': row.get('Forma de Utilização') || '',
        'Público-Alvo': row.get('Público-Alvo') || '',
        'Grau de Risco': row.get('Grau de Risco') || '',
        Status: row.get('Status') || 'Ativa'
      }));
      
      return res.status(200).json({ teses });
    }
    
    if (req.method === 'POST') {
      const { action, teseData, teseId } = req.body;
      
      if (action === 'create') {
        await sheet.loadHeaderRow();
        const rows = await sheet.getRows();
        
        const existingTeses = rows.map(row => ({
          Tese_ID: row.get('Tese_ID') || ''
        }));
        
        const newTeseId = generateTeseId(existingTeses);
        
        const newRow = await sheet.addRow({
          'Tese_ID': newTeseId,
          'Tipo': teseData.tipo || '',
          'Tema': teseData.tema || '',
          'Tributo do Crédito': teseData.tributo || '',
          'Base Legal': teseData.baseLegal || '',
          'Contexto do Direito': teseData.contexto || '',
          'Documentação Necessária': teseData.documentacao || '',
          'Informações a Serem Analisadas': teseData.informacoes || '',
          'Forma de Utilização': teseData.formaUtilizacao || '',
          'Público-Alvo': teseData.publicoAlvo || '',
          'Grau de Risco': teseData.grauRisco || 'Remoto',
          'Status': 'Ativa'
        });
        
        return res.status(201).json({ 
          success: true, 
          teseId: newTeseId,
          message: 'Tese criada com sucesso' 
        });
      }
      
      if (action === 'updateStatus') {
        await sheet.loadHeaderRow();
        const rows = await sheet.getRows();
        
        const targetRow = rows.find(row => row.get('Tese_ID') === teseId);
        if (!targetRow) {
          return res.status(404).json({ error: 'Tese não encontrada' });
        }
        
        const currentStatus = targetRow.get('Status');
        const newStatus = currentStatus === 'Ativa' ? 'Inativa' : 'Ativa';
        
        targetRow.set('Status', newStatus);
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
      const rows = await sheet.getRows();
      
      const targetRow = rows.find(row => row.get('Tese_ID') === teseId);
      if (!targetRow) {
        return res.status(404).json({ error: 'Tese não encontrada' });
      }
      
      // Atualizar campos
      if (teseData.tipo !== undefined) targetRow.set('Tipo', teseData.tipo);
      if (teseData.tema !== undefined) targetRow.set('Tema', teseData.tema);
      if (teseData.tributo !== undefined) targetRow.set('Tributo do Crédito', teseData.tributo);
      if (teseData.baseLegal !== undefined) targetRow.set('Base Legal', teseData.baseLegal);
      if (teseData.contexto !== undefined) targetRow.set('Contexto do Direito', teseData.contexto);
      if (teseData.documentacao !== undefined) targetRow.set('Documentação Necessária', teseData.documentacao);
      if (teseData.informacoes !== undefined) targetRow.set('Informações a Serem Analisadas', teseData.informacoes);
      if (teseData.formaUtilizacao !== undefined) targetRow.set('Forma de Utilização', teseData.formaUtilizacao);
      if (teseData.publicoAlvo !== undefined) targetRow.set('Público-Alvo', teseData.publicoAlvo);
      if (teseData.grauRisco !== undefined) targetRow.set('Grau de Risco', teseData.grauRisco);
      
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
