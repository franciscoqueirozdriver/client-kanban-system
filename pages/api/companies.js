import { appendCompanyImportRow, getCompanySheetCached } from '../../lib/googleSheets';
import { enrichCompanyData } from '../../lib/perplexity';

const stateMapping = {
  'Acre': 'AC', 'Alagoas': 'AL', 'Amapá': 'AP', 'Amazonas': 'AM', 'Bahia': 'BA', 'Ceará': 'CE',
  'Distrito Federal': 'DF', 'Espírito Santo': 'ES', 'Goiás': 'GO', 'Maranhão': 'MA', 'Mato Grosso': 'MT',
  'Mato Grosso do Sul': 'MS', 'Minas Gerais': 'MG', 'Pará': 'PA', 'Paraíba': 'PB', 'Paraná': 'PR',
  'Pernambuco': 'PE', 'Piauí': 'PI', 'Rio de Janeiro': 'RJ', 'Rio Grande do Norte': 'RN',
  'Rio Grande do Sul': 'RS', 'Rondônia': 'RO', 'Roraima': 'RR', 'Santa Catarina': 'SC', 'São Paulo': 'SP',
  'Sergipe': 'SE', 'Tocantins': 'TO'
};

function getUf(estado) {
  if (!estado) return '';
  const upper = estado.trim().toUpperCase();
  if (upper.length === 2 && Object.values(stateMapping).includes(upper)) {
    return upper;
  }
  const fromMap = Object.keys(stateMapping).find(key => key.toUpperCase() === upper);
  return fromMap ? stateMapping[fromMap] : '';
}

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
    estado: getUf(client?.uf),
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
    const idx = {
      cnpj: header.indexOf('cnpj'),
      nome: header.indexOf('nome'),
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
