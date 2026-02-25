const crypto = require('crypto');
const fs = require('fs');
const dotenv = require('dotenv');
const env = dotenv.parse(fs.readFileSync('.env'));
const key = env.GOOGLE_PRIVATE_KEY;

try {
  console.log('Tentando decodificar chave de .env com crypto.createPrivateKey...');
  console.log('Key start:', key.substring(0, 30));
  const privateKey = crypto.createPrivateKey(key);
  console.log('✅ Chave de .env decodificada com sucesso!');
} catch (err) {
  console.error('❌ Falha ao decodificar chave de .env:', err.message);
}
