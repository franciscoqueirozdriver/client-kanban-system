import {
  getMessageSheetCached,
  appendMessageRow,
  generateNextMessageId,
} from '../../lib/googleSheets';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const {
      clienteId,
      tipo,
      deFase,
      paraFase,
      canal,
      observacao,
      mensagem,
    } = req.body || {};

    if (!clienteId || !tipo) {
      return res.status(400).json({ error: 'Dados obrigatórios ausentes' });
    }

    const messageId = await generateNextMessageId();
    const now = new Date();
    const dataHora = now
      .toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour12: false,
      })
      .replace(',', '');

    const rowData = {
      message_id: messageId,
      cliente_id: clienteId,
      data_hora: dataHora,
      tipo,
    };
    if (deFase) rowData.de_fase = deFase;
    if (paraFase) rowData.para_fase = paraFase;
    if (canal) rowData.canal = canal;
    if (observacao) rowData.observacao = observacao;
    if (mensagem) rowData.mensagem = mensagem;

    try {
      await appendMessageRow(rowData);
      return res.status(200).json(rowData);
    } catch (err) {
      console.error('Erro ao registrar interação:', err);
      return res.status(500).json({ error: 'Falha ao registrar interação' });
    }
  }

  if (req.method === 'GET') {
    try {
      const clienteId = req.query.clienteId || '';
      const sheet = await getMessageSheetCached();
      const rows = sheet.data.values || [];
      if (rows.length === 0) return res.status(200).json([]);
      const [header, ...data] = rows;
      const idx = {
        id: header.indexOf('Message_ID'),
        cliente: header.indexOf('Cliente_ID'),
        dataHora: header.indexOf('Data_Hora'),
        tipo: header.indexOf('Tipo'),
        deFase: header.indexOf('De_Fase'),
        paraFase: header.indexOf('Para_Fase'),
        canal: header.indexOf('Canal'),
        obs: header.indexOf('Observacao'),
        msg: header.indexOf('Mensagem'),
      };

      const itens = data
        .filter((r) => !clienteId || r[idx.cliente] === clienteId)
        .map((r) => ({
          messageId: r[idx.id] || '',
          clienteId: r[idx.cliente] || '',
          dataHora: r[idx.dataHora] || '',
          tipo: r[idx.tipo] || '',
          deFase: r[idx.deFase] || '',
          paraFase: r[idx.paraFase] || '',
          canal: r[idx.canal] || '',
          observacao: r[idx.obs] || '',
          mensagem: r[idx.msg] || '',
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
