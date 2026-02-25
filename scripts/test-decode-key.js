const crypto = require('crypto');
const fs = require('fs');
const dotenv = require('dotenv');
const env = dotenv.parse(fs.readFileSync('.env'));
const key = env.GOOGLE_PRIVATE_KEY;

try {
  console.log('Tentando decodificar chave com crypto.createPrivateKey...');
  const privateKey = crypto.createPrivateKey(key);
  console.log('✅ Chave decodificada com sucesso!');
  console.log('Tipo:', privateKey.type);
  console.log('Assimétrico:', privateKey.asymmetricKeyType);
} catch (err) {
  console.error('❌ Falha ao decodificar chave:', err.message);
}
