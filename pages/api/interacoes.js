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
      mensagem,
      messageId,
    } = req.body || {};

    console.log('POST /interacoes body', req.body);

    if (!clienteId || !tipo || !dataHora) {
      return res.status(400).json({ error: 'Dados obrigatórios ausentes' });
    }

    const rowData = {
      cliente_id: clienteId,
      message_id: messageId || `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      tipo,
      data_hora: dataHora,
    };
    if (deFase) rowData.de_fase = deFase;
    if (paraFase) rowData.para_fase = paraFase;
    if (canal) rowData.canal = canal;
    if (observacao) rowData.observacao = observacao;
    if (mensagemUsada) rowData.mensagem_usada = mensagemUsada;
    if (mensagem) rowData.mensagem = mensagem;

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
      const clienteId = req.query.clienteId || '';
      const sheet = await getHistorySheetCached();
      const rows = sheet.data.values || [];
      if (rows.length === 0) return res.status(200).json([]);
      const [header, ...data] = rows;
      const idx = {
        cliente: header.indexOf('Cliente_ID'),
        messageId: header.indexOf('Message_ID'),
        dataHora: header.indexOf('Data/Hora'),
        tipo: header.indexOf('Tipo'),
        deFase: header.indexOf('De_Fase'),
        paraFase: header.indexOf('Para_Fase'),
        canal: header.indexOf('Canal'),
        obs:
          header.indexOf('Observacao') !== -1
            ? header.indexOf('Observacao')
            : header.indexOf('Observação'),
        msg: header.indexOf('Mensagem_Usada'),
        msgTxt: header.indexOf('Mensagem'),
      };

      const itens = data
        .filter((r) => !clienteId || r[idx.cliente] === clienteId)
        .map((r) => ({
          clienteId: r[idx.cliente] || '',
          messageId: r[idx.messageId] || '',
          dataHora: r[idx.dataHora] || '',
          tipo: r[idx.tipo] || '',
          deFase: r[idx.deFase] || '',
          paraFase: r[idx.paraFase] || '',
          canal: r[idx.canal] || '',
          observacao: r[idx.obs] || '',
          mensagemUsada: r[idx.msg] || '',
          mensagem: r[idx.msgTxt] || '',
        }))
        .sort((a, b) => (a.dataHora < b.dataHora ? 1 : -1));

      return res.status(200).json(itens);
    } catch (err) {
      console.error('Erro ao buscar histórico:', err);
      return res.status(500).json({ error: 'Erro ao ler histórico' });
    }
  }

  return res.status(405).end();
}
