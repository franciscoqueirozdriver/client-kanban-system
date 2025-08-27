import { getSheetData } from '../lib/googleSheets.js';

async function main() {
  try {
    const { rows } = await getSheetData('Sheet1');
    const total = rows.length;

    const idCounts = new Map<string, number>();
    const empresas = new Set<string>();

    rows.forEach(row => {
      const id = row['Cliente_ID'];
      if (id) idCounts.set(id, (idCounts.get(id) || 0) + 1);
      const empresa = row['Organização - Nome'] || row['Nome da Empresa'] || row['Nome do Lead'];
      if (empresa) empresas.add(empresa);
    });

    const idsUnicos = idCounts.size;
    const idsOcorrenciaUnica = Array.from(idCounts.values()).filter(v => v === 1).length;
    const empresasUnicas = empresas.size;

    console.log(JSON.stringify({
      totalLinhas: total,
      idsUnicos,
      idsOcorrenciaUnica,
      empresasUnicas,
    }, null, 2));

    if (total < 3500) {
      console.error('Dataset menor que 3500 linhas!');
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Erro ao verificar dataset:', err.message || err);
    process.exit(1);
  }
}

main();
