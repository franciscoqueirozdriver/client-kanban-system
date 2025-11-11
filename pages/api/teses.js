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
  let sheet = doc.sheetsByTitle['teses'] ||
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
        'tributo_do_credito': row.get('tributo_do_credito') || '',
        'base_legal': row.get('base_legal') || '',
        'contexto_do_direito': row.get('contexto_do_direito') || '',
        'documentacao_necessaria': row.get('documentacao_necessaria') || '',
        'informacoes_a_serem_analisadas': row.get('informacoes_a_serem_analisadas') || '',
        'forma_de_utilizacao': row.get('forma_de_utilizacao') || '',
        'publico_alvo': row.get('publico_alvo') || '',
        'grau_de_risco': row.get('grau_de_risco') || '',
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
          'tributo_do_credito': teseData.tributo || '',
          'base_legal': teseData.baseLegal || '',
          'contexto_do_direito': teseData.contexto || '',
          'documentacao_necessaria': teseData.documentacao || '',
          'informacoes_a_serem_analisadas': teseData.informacoes || '',
          'forma_de_utilizacao': teseData.formaUtilizacao || '',
          'publico_alvo': teseData.publicoAlvo || '',
          'grau_de_risco': teseData.grauRisco || 'Remoto',
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
      if (teseData.tributo !== undefined) targetRow.set('tributo_do_credito', teseData.tributo);
      if (teseData.baseLegal !== undefined) targetRow.set('base_legal', teseData.baseLegal);
      if (teseData.contexto !== undefined) targetRow.set('contexto_do_direito', teseData.contexto);
      if (teseData.documentacao !== undefined) targetRow.set('documentacao_necessaria', teseData.documentacao);
      if (teseData.informacoes !== undefined) targetRow.set('informacoes_a_serem_analisadas', teseData.informacoes);
      if (teseData.formaUtilizacao !== undefined) targetRow.set('forma_de_utilizacao', teseData.formaUtilizacao);
      if (teseData.publicoAlvo !== undefined) targetRow.set('publico_alvo', teseData.publicoAlvo);
      if (teseData.grauRisco !== undefined) targetRow.set('grau_de_risco', teseData.grauRisco);
      
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
