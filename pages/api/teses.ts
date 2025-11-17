import { NextApiRequest, NextApiResponse } from 'next';
import { readSheet, appendRow, updateRows } from '@/lib/googleSheets';
import { SHEETS } from '@/lib/sheets-mapping';
import { TesesRow } from '@/types/sheets';

function generateTeseId(existingTeses: TesesRow[]) {
  const prefix = 'HABPISCOFINS_';
  const existingNumbers = existingTeses
    .map(tese => tese.tese_id)
    .filter(id => id && id.startsWith(prefix))
    .map(id => parseInt(id!.replace(prefix, ''), 10))
    .filter(num => !isNaN(num));

  const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
  const nextNumber = maxNumber + 1;

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const rows = await readSheet<TesesRow>(SHEETS.TESES);

      const teses = rows.map(row => ({
        id: row._rowNumber,
        tese_id: row.tese_id || '',
        tipo: row.tipo || '',
        tema: row.tema || '',
        tributo_do_credito: row.tributo_do_credito || '',
        base_legal: row.base_legal || '',
        contexto_do_direito: row.contexto_do_direito || '',
        documentacao_necessaria: row.documentacao_necessaria || '',
        informacoes_a_serem_analisadas: row.informacoes_a_serem_analisadas || '',
        forma_de_utilizacao: row.forma_de_utilizacao || '',
        publico_alvo: row.publico_alvo || '',
        grau_de_risco: row.grau_de_risco || '',
        status: row.status || 'Ativa'
      }));

      return res.status(200).json({ teses });
    }

    if (req.method === 'POST') {
      const { action, teseData, teseId } = req.body;

      if (action === 'create') {
        const rows = await readSheet<TesesRow>(SHEETS.TESES);
        const newTeseId = generateTeseId(rows);

        const newRow: Partial<TesesRow> = {
          tese_id: newTeseId,
          tipo: teseData.tipo || '',
          tema: teseData.tema || '',
          tributo_do_credito: teseData.tributo || '',
          base_legal: teseData.baseLegal || '',
          contexto_do_direito: teseData.contexto || '',
          documentacao_necessaria: teseData.documentacao || '',
          informacoes_a_serem_analisadas: teseData.informacoes || '',
          forma_de_utilizacao: teseData.formaUtilizacao || '',
          publico_alvo: teseData.publicoAlvo || '',
          grau_de_risco: teseData.grauRisco || 'Remoto',
          status: 'Ativa'
        };

        await appendRow(SHEETS.TESES, newRow);

        return res.status(201).json({
          success: true,
          teseId: newTeseId,
          message: 'Tese criada com sucesso'
        });
      }

      if (action === 'updateStatus') {
        const rows = await readSheet<TesesRow>(SHEETS.TESES);
        const targetRow = rows.find(row => row.tese_id === teseId);
        if (!targetRow) {
          return res.status(404).json({ error: 'Tese não encontrada' });
        }

        const currentStatus = targetRow.status;
        const newStatus = currentStatus === 'Ativa' ? 'Inativa' : 'Ativa';

        const updatedRow = { ...targetRow, status: newStatus };
        await updateRows(SHEETS.TESES, [updatedRow]);

        return res.status(200).json({
          success: true,
          newStatus,
          message: `Tese ${newStatus.toLowerCase()} com sucesso`
        });
      }
    }

    if (req.method === 'PUT') {
      const { teseId, teseData } = req.body;

      const rows = await readSheet<TesesRow>(SHEETS.TESES);
      const targetRow = rows.find(row => row.tese_id === teseId);
      if (!targetRow) {
        return res.status(404).json({ error: 'Tese não encontrada' });
      }

      const updatedRow = { ...targetRow };
      // Atualizar campos
      if (teseData.tipo !== undefined) updatedRow.tipo = teseData.tipo;
      if (teseData.tema !== undefined) updatedRow.tema = teseData.tema;
      if (teseData.tributo !== undefined) updatedRow.tributo_do_credito = teseData.tributo;
      if (teseData.baseLegal !== undefined) updatedRow.base_legal = teseData.baseLegal;
      if (teseData.contexto !== undefined) updatedRow.contexto_do_direito = teseData.contexto;
      if (teseData.documentacao !== undefined) updatedRow.documentacao_necessaria = teseData.documentacao;
      if (teseData.informacoes !== undefined) updatedRow.informacoes_a_serem_analisadas = teseData.informacoes;
      if (teseData.formaUtilizacao !== undefined) updatedRow.forma_de_utilizacao = teseData.formaUtilizacao;
      if (teseData.publicoAlvo !== undefined) updatedRow.publico_alvo = teseData.publicoAlvo;
      if (teseData.grauRisco !== undefined) updatedRow.grau_de_risco = teseData.grauRisco;

      await updateRows(SHEETS.TESES, [updatedRow]);

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
      details: (error as Error).message
    });
  }
}
