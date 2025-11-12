import { lookupCep } from '../../lib/cep.js';

export default async function handler(req, res) {
  const cep = req.method === 'GET' ? req.query.cep : req.body?.cep;
  if (!cep) {
    return res.status(400).json({ ok: false, error: 'CEP é obrigatório' });
  }
  try {
    const data = await lookupCep(cep);
    return res.status(200).json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
