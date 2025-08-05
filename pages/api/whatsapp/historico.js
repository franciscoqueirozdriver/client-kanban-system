import { getWhatsAppMessagesByClienteId } from '../../../lib/googleSheets';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const clienteId = req.query.clienteId || '';
  try {
    const messages = await getWhatsAppMessagesByClienteId(clienteId);
    return res.status(200).json(messages);
  } catch (err) {
    console.error('Erro ao buscar histórico do WhatsApp:', err);
    return res.status(500).json({ error: 'Falha ao buscar histórico' });
  }
}
