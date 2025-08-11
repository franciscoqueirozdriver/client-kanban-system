import { appendCompanyImportRow, getCompanySheetCached } from '../../lib/googleSheets';

// Esta função é um placeholder. A implementação real deveria usar o nome da
// empresa para buscar dados detalhados (CNPJ, endereço, etc.) de uma fonte
// externa, como uma API de dados de empresas ou um serviço de IA.
const enrichCompanyData = async (companyName) => {
  console.log(`--- STUB: A função enrichCompanyData foi chamada para: ${companyName}`);
  console.log('--- STUB: Retornando dados vazios pois a implementação real não existe.');
  // Como a implementação real não existe, retornamos um objeto que apenas
  // contém o nome, para que o resto do fluxo possa ser validado.
  return {
    nome: companyName,
    site: '',
    pais: '',
    estado: '',
    cidade: '',
    logradouro: '',
    numero: '',
    bairro: '',
    complemento: '',
    cep: '',
    cnpj: '',
    ddi: '',
    telefone: '',
    telefone2: '',
    observacao: 'Dados não enriquecidos - implementação pendente.',
  };
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const { client } = req.body || {};
  if (!client || !client.company) {
    return res.status(400).json({ error: 'Dados do cliente ou nome da empresa ausentes.' });
  }

  try {
    // 1. Enriquecer os dados
    const enrichedData = await enrichCompanyData(client.company);

    // 2. Construir o objeto 'empresa' a partir dos dados enriquecidos
    const empresa = {
      nome: enrichedData.nome || client.company,
      site: enrichedData.site || '',
      pais: enrichedData.pais || '',
      estado: enrichedData.estado || '',
      cidade: enrichedData.cidade || '',
      logradouro: enrichedData.logradouro || '',
      numero: enrichedData.numero || '',
      bairro: enrichedData.bairro || '',
      complemento: enrichedData.complemento || '',
      cep: enrichedData.cep || '',
      cnpj: enrichedData.cnpj || '',
      ddi: enrichedData.ddi || '',
      telefone: enrichedData.telefone || '',
      telefone2: enrichedData.telefone2 || '',
      observacao: enrichedData.observacao || '',
    };

    // 3. Verificar duplicidade na planilha de importação
    const sheet = await getCompanySheetCached();
    const rows = sheet.data.values || [];
    if (rows.length > 0) {
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
          (empresa.cnpj && cnpjVal && empresa.cnpj === cnpjVal) ||
          (empresa.nome && nomeVal && empresa.nome.toLowerCase() === nomeVal.toLowerCase())
        );
      });
      if (duplicate) {
        return res.status(200).json({ duplicate: true });
      }
    }

    // 4. Adicionar à planilha
    const appendRes = await appendCompanyImportRow(empresa);
    const range = appendRes.data?.updates?.updatedRange || '';
    const match = range.match(/!(?:[A-Z]+)(\d+):/);
    const row = match ? parseInt(match[1], 10) : undefined;
    return res.status(200).json({ row });

  } catch (err) {
    console.error('Erro no processo de registro da empresa:', err);
    return res.status(500).json({ error: 'Erro interno ao registrar a empresa.' });
  }
}
