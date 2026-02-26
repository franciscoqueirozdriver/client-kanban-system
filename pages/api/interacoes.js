import { getHistorySheetCached, appendHistoryRow } from '../../lib/googleSheets';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const {
      clienteId,
      tipo,
      dataHora,
      deFase,
      paraFase,
      canal,
      observacao,
      mensagemUsada,
    } = req.body || {};

    if (!clienteId || !tipo || !dataHora) {
      return res.status(400).json({ error: 'Dados obrigatórios ausentes' });
    }

    const rowData = {
      cliente_id: clienteId,
      tipo,
      data_hora: dataHora,
    };
    if (deFase) rowData.de_fase = deFase;
    if (paraFase) rowData.para_fase = paraFase;
    if (canal) rowData.canal = canal;
    if (observacao) rowData.observacao = observacao;
    if (mensagemUsada) rowData.mensagem_usada = mensagemUsada;

    try {
      await appendHistoryRow(rowData);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('Erro ao registrar interação:', err);
      return res.status(500).json({ error: 'Falha ao registrar interação' });
    }
  }

  if (req.method === 'GET') {
    try {
      const start = Date.now();
      const clienteId = req.query.clienteId || '';
      const sheet = await getHistorySheetCached();
      const rows = sheet.data.values || [];
      if (rows.length === 0) return res.status(200).json([]);
      const [header, ...data] = rows;
      const getIdx = (name) => {
        let i = header.indexOf(name);
        if (i === -1) {
          const snake = name.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_|_$/g, '');
          i = header.indexOf(snake);
        }
        return i;
      };

      const idx = {
        cliente: getIdx('Cliente_ID'),
        dataHora: getIdx('Data_Hora'),
        tipo: getIdx('Tipo'),
        deFase: getIdx('De_Fase'),
        paraFase: getIdx('Para_Fase'),
        canal: getIdx('Canal'),
        obs: getIdx('Observacao'),
        msg: getIdx('Mensagem_Usada'),
      };

      const itensRaw = data
        .filter((r) => !clienteId || r[idx.cliente] === clienteId)
        .map((r) => ({
          clienteId: r[idx.cliente] || '',
          dataHora: r[idx.dataHora] || '',
          tipo: r[idx.tipo] || '',
          deFase: r[idx.deFase] || '',
          paraFase: r[idx.paraFase] || '',
          canal: r[idx.canal] || '',
          observacao: r[idx.obs] || '',
          mensagemUsada: r[idx.msg] || '',
        }))
        .sort((a, b) => (a.dataHora < b.dataHora ? 1 : -1));

      const limitParam = parseInt(req.query.limit, 10);
      const limit = Number.isFinite(limitParam) && limitParam >= 0 ? limitParam : itensRaw.length;
      const itens = itensRaw.slice(0, limit);

      console.log('INTERACOES_READ', { duration: Date.now() - start, count: itens.length });
      return res.status(200).json(itens);
    } catch (err) {
      console.error('Erro ao buscar histórico:', err);
      return res.status(500).json({ error: 'Erro ao ler histórico' });
    }
  }

  return res.status(405).end();
}
