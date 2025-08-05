const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());

const whatsapp = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

whatsapp.on('qr', (qr) => {
  console.log('QR RECEIVED');
  qrcode.generate(qr, { small: true });
});

whatsapp.on('ready', () => {
  console.log('WhatsApp client ready');
});

whatsapp.on('message', async (message) => {
  const number = message.from.replace(/@c\.us$/, '');
  const payload = {
    Cliente_ID: null,
    Numero: number,
    Mensagem: message.body,
    Direcao: 'recebida',
    Data_Hora: new Date().toISOString(),
  };
  try {
    await fetch('http://localhost:3000/api/whatsapp/registrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('Erro ao registrar mensagem recebida:', err);
  }
});

whatsapp.initialize();

app.post('/send', async (req, res) => {
  const { Cliente_ID, Numero, Mensagem } = req.body || {};
  if (!Numero || !Mensagem) {
    return res.status(400).json({ error: 'Numero e Mensagem são obrigatórios' });
  }
  try {
    const chatId = Numero.includes('@c.us') ? Numero : `${Numero}@c.us`;
    await whatsapp.sendMessage(chatId, Mensagem);
    await fetch('http://localhost:3000/api/whatsapp/registrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Cliente_ID: Cliente_ID || null,
        Numero,
        Mensagem,
        Direcao: 'enviada',
        Data_Hora: new Date().toISOString(),
      }),
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err);
    return res.status(500).json({ error: 'Falha ao enviar mensagem' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`WhatsApp service listening on port ${PORT}`);
});
