const crypto = require('crypto');
const fs = require('fs');
const dotenv = require('dotenv');
const env = dotenv.parse(fs.readFileSync('.env'));
const key = env.GOOGLE_PRIVATE_KEY;

try {
  console.log('Testando chave bruta com crypto.createSign...');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update('test data');
  const signature = sign.sign(key, 'base64');
  console.log('✅ Chave válida! Assinatura gerada.');
} catch (err) {
  console.error('❌ Erro na chave:', err.message);
  if (err.stack) console.error(err.stack);
}
