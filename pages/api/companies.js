import { appendCompanyImportRow, getCompanySheetCached, getColumnName } from '../../lib/googleSheets';
import { enrichCompanyData } from '../../lib/perplexity';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const { client } = req.body || {};
  if (!client) {
    return res.status(400).json({ error: 'Client data missing' });
  }

  let empresa = {
    nome: client?.company || '',
    site: client?.website || '',
    pais: client?.country || '',
    estado: client?.state || '',
    cidade: client?.city || '',
    logradouro: client?.address || '',
    numero: client?.number || '',
    bairro: client?.neighborhood || '',
    complemento: client?.complement || '',
    cep: client?.zipcode || '',
    cnpj: client?.cnpj || '',
    ddi: client?.ddi || '55',
    telefone: client?.phone || '',
    telefone2: client?.phone2 || '',
    observacao: client?.observation || '',
  };

  // verificar duplicidade na planilha
  try {
    const sheet = await getCompanySheetCached();
    const rows = sheet.data.values || [];
    const [header, ...dataRows] = rows;
    
    // ✅ Usar nomes normalizados para buscar índices
    const cnpjCol = getColumnName('cnpj_empresa');
    const nomeCol = getColumnName('nome_da_empresa');
    
    const idx = {
      cnpj: header.indexOf(cnpjCol),
      nome: header.indexOf(nomeCol),
    };
    const duplicate = dataRows.some((row) => {
      const cnpjVal = idx.cnpj >= 0 ? row[idx.cnpj] : '';
      const nomeVal = idx.nome >= 0 ? row[idx.nome] : '';
      return (
        (empresa.cnpj && cnpjVal === empresa.cnpj) ||
        (empresa.nome && nomeVal && nomeVal.toLowerCase() === empresa.nome.toLowerCase())
      );
    });
    if (duplicate) {
      return res.status(200).json({ duplicate: true });
    }
  } catch (err) {
    console.error('Erro ao verificar duplicidade:', err);
  }

  // enriquecer dados
  empresa = await enrichCompanyData(empresa);

  try {
    const appendRes = await appendCompanyImportRow(empresa);
    const range = appendRes.data?.updates?.updatedRange || '';
    const match = range.match(/!(?:[A-Z]+)(\d+):/);
    const row = match ? parseInt(match[1], 10) : undefined;
    return res.status(200).json({ row });
  } catch (err) {
    console.error('Erro ao registrar planilha:', err);
    return res.status(500).json({ error: 'Erro ao registrar planilha' });
  }
}

