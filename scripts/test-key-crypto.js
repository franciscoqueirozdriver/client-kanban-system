const crypto = require('crypto');
require('dotenv').config();

const key = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

try {
  console.log('Testando chave privada com crypto.createSign...');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update('test data');
  const signature = sign.sign(key, 'base64');
  console.log('✅ Chave válida! Assinatura gerada.');
} catch (err) {
  console.error('❌ Erro na chave:', err.message);
}
