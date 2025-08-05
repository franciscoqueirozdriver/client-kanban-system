import { appendWhatsAppRow } from '../../../lib/googleSheets';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { Cliente_ID = null, Numero, Mensagem, Direcao, Data_Hora } = req.body || {};
  if (!Numero || !Mensagem || !Direcao || !Data_Hora) {
    return res.status(400).json({ error: 'Dados obrigatórios ausentes' });
  }

  try {
    await appendWhatsAppRow({
      cliente_id: Cliente_ID,
      numero: Numero,
      mensagem: Mensagem,
      direcao: Direcao,
      data_hora: Data_Hora,
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Erro ao registrar mensagem do WhatsApp:', err);
    return res.status(500).json({ error: 'Falha ao registrar mensagem' });
  }
}
