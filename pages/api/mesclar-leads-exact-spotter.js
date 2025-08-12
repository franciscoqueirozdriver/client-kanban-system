import { getSheetData, getSheetsClient } from '../../lib/googleSheets';
import { normalizeUF } from '../../lib/perplexity';

function clean(v) {
  return (v || '').toString().trim();
}

function columnToLetter(index) {
  let letter = '';
  let temp = index;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

function mergePhones(a = '', b = '') {
  const parts = [...a.split(';'), ...b.split(';')]
    .map((p) => p.trim())
    .filter(Boolean);
  return Array.from(new Set(parts)).join(';');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { produto } = req.body || {};
  try {
    // Carrega dados das abas
    const layout = await getSheetData('layout_importacao_empresas');
    const sheet1 = await getSheetData('Sheet1');
    const padroes = await getSheetData('Padroes');
    const leads = await getSheetData('Leads Exact Spotter');

    const produtosValidos = Array.from(new Set(padroes.rows.map((r) => r.Produtos).filter(Boolean)));
    const mercadosValidosRaw = padroes.rows.map((r) => r.Mercados).filter(Boolean);
    const normalizeTxt = (s) => clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const mercadosValidos = new Set(mercadosValidosRaw.map((m) => normalizeTxt(m)));

    if (!produto || !produtosValidos.includes(produto)) {
      return res.status(400).json({ error: 'Produto inválido' });
    }

    const sheet1Map = new Map(sheet1.rows.map((r) => [r.Client_ID, r]));
    const leadsMap = new Map(leads.rows.map((r) => [r.Client_ID, r]));

    const sheetsClient = await getSheetsClient();
    const spreadsheetId = process.env.SPREADSHEET_ID;

    let criadas = 0,
      atualizadas = 0,
      ignoradas = 0;
    const erros = [];

    for (const row of layout.rows) {
      const clientId = clean(row.Client_ID);
      if (!clientId) continue;
      const base = sheet1Map.get(clientId);
      if (!base) continue;

      const existing = leadsMap.get(clientId);
      const novoLead = { Client_ID: clientId };

      // Nome do Lead
      novoLead['Nome do Lead'] = `${clean(row['Nome da Empresa'])}${produto ? ' - ' + produto : ''}`;
      novoLead['Origem'] = 'Carteira de Clientes';
      novoLead['Sub-Origem'] = '';

      // Mercado
      const seg = base['Organização - Segmento'] || '';
      novoLead['Mercado'] = mercadosValidos.has(normalizeTxt(seg)) ? seg : 'N/A';

      // Produto
      novoLead['Produto'] = produto;

      // Campos de endereço / site
      const site = clean(row['Site Empresa']).replace(/\/+$, '');
      if (site) novoLead['Site'] = site;
      if (row['Estado Empresa']) novoLead['Estado Empresa'] = normalizeUF(row['Estado Empresa']);
      ['Cidade Empresa', 'Logradouro Empresa', 'Numero Empresa', 'Bairro Empresa', 'Complemento Empresa', 'CEP Empresa'].forEach(
        (c) => {
          const v = clean(row[c]);
          if (v) novoLead[c] = v;
        }
      );

      // Telefones
      const telCard = clean(row['Telefones Card']);
      const telOrigem = clean(row['Telefones Empresa']) || clean(base['Telefone Normalizado']);
      const telefones = mergePhones(telCard, telOrigem);
      if (telefones) {
        novoLead['Telefones'] = telefones;
        novoLead['DDI'] = clean(row['DDI Empresa']);
      }

      // Observação
      const obs = clean(row['Observação Empresa']);
      if (obs) novoLead['Observação'] = obs;

      // CPF/CNPJ
      const cnpj = clean(row['CNPJ Empresa']);
      if (cnpj) novoLead['CPF/CNPJ'] = cnpj;

      // Contatos do card (derivados da Sheet1)
      const nomeContato = clean(base['Negócio - Pessoa de contato']);
      const emailContato =
        clean(base['Pessoa - Email - Work']) || clean(base['Pessoa - Email - Home']) || clean(base['Pessoa - Email - Other']);
      const cargoContato = clean(base['Pessoa - Cargo']);
      const telsContato = clean(base['Telefone Normalizado']);
      if (nomeContato || emailContato || cargoContato || telsContato) {
        if (!nomeContato) erros.push(clientId);
        novoLead['Nome Contato'] = nomeContato || '***FALTANDO***';
        if (emailContato) novoLead['E-mail Contato'] = emailContato;
        if (cargoContato) novoLead['Cargo Contato'] = cargoContato;
        if (telsContato) {
          novoLead['Telefones Contato'] = mergePhones('', telsContato);
          novoLead['DDI Contato'] = clean(row['DDI Empresa']);
        }
      }

      // Nome da Empresa, Etapa, Funil
      novoLead['Nome da Empresa'] = clean(row['Nome da Empresa']);
      novoLead['Etapa'] = 'Agendados';
      novoLead['Funil'] = 'Padrão';

      if (!existing) {
        // Preparar linha completa
        const rowVals = leads.headers.map((h) => clean(novoLead[h] || ''));
        await sheetsClient.spreadsheets.values.append({
          spreadsheetId,
          range: 'Leads Exact Spotter',
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values: [rowVals] },
        });
        criadas++;
        leadsMap.set(clientId, { ...novoLead, _rowNumber: leads.rows.length + criadas + atualizadas + 1 });
      } else {
        // Mesclar sem sobrescrever valores existentes
        let changed = false;
        const merged = { ...existing };
        for (const h of leads.headers) {
          const nv = clean(novoLead[h]);
          if (!nv) continue;
          if (h === 'Telefones' || h === 'Telefones Contato') {
            const mergedPhones = mergePhones(existing[h], nv);
            if (mergedPhones !== clean(existing[h])) {
              merged[h] = mergedPhones;
              changed = true;
            }
          } else if (!clean(existing[h])) {
            merged[h] = nv;
            changed = true;
          }
        }
        if (changed) {
          const rowVals = leads.headers.map((h) => clean(merged[h] || ''));
          const lastCol = columnToLetter(leads.headers.length - 1);
          const range = `Leads Exact Spotter!A${existing._rowNumber}:${lastCol}${existing._rowNumber}`;
          await sheetsClient.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: 'RAW',
            requestBody: { values: [rowVals] },
          });
          atualizadas++;
        } else {
          ignoradas++;
        }
      }
    }

    res.status(200).json({ criadas, atualizadas, ignoradas, erros });
  } catch (err) {
    console.error('[mesclar-leads-exact-spotter] fail', err);
    res.status(500).json({ error: err.message });
  }
}
