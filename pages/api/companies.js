import { appendCompanyImportRow, getCompanySheetCached } from '../../lib/googleSheets';

// A função enrichCompanyData foi movida para este arquivo para evitar dependências circulares
// e para limpar a estrutura de arquivos. A implementação original foi perdida durante uma
// refatoração anterior e atualmente é um placeholder.
const enrichCompanyData = async (empresa) => {
  // TODO: Implementar a lógica de enriquecimento de dados da empresa usando a API do Perplexity.
  console.log('A função enrichCompanyData foi chamada, mas está usando a implementação de placeholder.');
  return empresa;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const { client } = req.body || {};
  if (!client) {
    return res.status(400).json({ error: 'Client data missing' });
  }

  const hasPhone = client.contacts?.some((c) => c.normalizedPhones?.length > 0);
  const allPhones = client.contacts?.flatMap((c) => c.normalizedPhones || []) || [];

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
    ddi: hasPhone ? (client.ddi || '55') : '',
    telefone: allPhones[0] || '',
    telefone2: allPhones[1] || '',
    observacao: client?.observation || '',
  };

  // verificar duplicidade na planilha
  try {
    const sheet = await getCompanySheetCached();
    const rows = sheet.data.values || [];
    const [header, ...dataRows] = rows;
    const lowerHeader = header.map((h) => (h ? h.toLowerCase() : ''));
    const idx = {
      cnpj: lowerHeader.indexOf('cnpj'),
      nome: lowerHeader.indexOf('nome'),
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
