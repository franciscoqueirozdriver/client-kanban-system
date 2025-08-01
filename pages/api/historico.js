import {
  getLogSheetCached,
  appendLogRow,
} from '../../lib/googleSheets';

function gerarId(clienteId) {
  const ts = new Date()
    .toISOString()
    .replace(/[-:T]/g, '')
    .split('.')[0];
  return `MSG-${clienteId}-${ts}`;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const clienteId = req.query.clienteId || '';
      const sheet = await getLogSheetCached();
      const rows = sheet.data.values || [];
      if (rows.length === 0) return res.status(200).json([]);
      const [header, ...data] = rows;
      const idx = {
        msg: header.indexOf('Message_ID'),
        cliente: header.indexOf('Cliente_ID'),
        dataHora: header.indexOf('Data_Hora'),
        tipo: header.indexOf('Tipo'),
        deFase: header.indexOf('De_Fase'),
        paraFase: header.indexOf('Para_Fase'),
        canal: header.indexOf('Canal'),
        obs: header.indexOf('Observacao'),
        msgTxt: header.indexOf('Mensagem'),
      };

      const itens = data
        .filter((r) => !clienteId || r[idx.cliente] === clienteId)
        .map((r) => ({
          messageId: r[idx.msg] || '',
          clienteId: r[idx.cliente] || '',
          dataHora: r[idx.dataHora] || '',
          tipo: r[idx.tipo] || '',
          deFase: r[idx.deFase] || '',
          paraFase: r[idx.paraFase] || '',
          canal: r[idx.canal] || '',
          observacao: r[idx.obs] || '',
          mensagem: r[idx.msgTxt] || '',
        }))
        .sort((a, b) => (a.dataHora < b.dataHora ? 1 : -1));

      return res.status(200).json(itens);
    } catch (err) {
      console.error('Erro ao buscar histórico:', err);
      return res.status(500).json({ error: 'Erro ao ler histórico' });
    }
  }

  if (req.method === 'POST') {
    try {
      const {
        messageId,
        clienteId,
        dataHora,
        tipo,
        deFase,
        paraFase,
        canal,
        observacao,
        mensagem,
      } = req.body || {};

      if (!clienteId || !dataHora || !tipo) {
        return res.status(400).json({ error: 'Dados obrigatórios ausentes' });
      }

      const finalId = messageId || gerarId(clienteId);

      const rowData = {
        message_id: finalId,
        cliente_id: clienteId,
        data_hora: dataHora,
        tipo,
        de_fase: deFase,
        para_fase: paraFase,
        canal,
        observacao,
        mensagem,
      };

      await appendLogRow(rowData);
      return res.status(200).json({ ok: true, messageId: finalId });
    } catch (err) {
      console.error('Erro ao registrar histórico:', err);
      return res.status(500).json({ error: 'Falha ao registrar histórico' });
    }
  }

  return res.status(405).end();
}

