const crypto = require('crypto');
const fs = require('fs');
const content = fs.readFileSync('env.local', 'utf8');
const match = content.match(/GOOGLE_PRIVATE_KEY="([^"]+)"/);
if (match) {
  const key = match[1].replace(/\\n/g, '\n');
  try {
    console.log('Tentando decodificar chave de env.local...');
    const privateKey = crypto.createPrivateKey(key);
    console.log('✅ Chave de env.local decodificada com sucesso!');
  } catch (err) {
    console.error('❌ Falha ao decodificar chave de env.local:', err.message);
  }
} else {
  console.error('❌ GOOGLE_PRIVATE_KEY não encontrada em env.local');
}
