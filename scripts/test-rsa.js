const crypto = require('crypto');
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' }
});

try {
  console.log('Testando RSA signing com chave gerada...');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update('test');
  sign.sign(privateKey);
  console.log('✅ RSA signing funciona no sandbox!');
} catch (err) {
  console.error('❌ RSA signing falhou:', err.message);
}
