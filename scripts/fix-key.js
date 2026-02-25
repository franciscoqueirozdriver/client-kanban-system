const fs = require('fs');
const dotenv = require('dotenv');

const envConfig = dotenv.parse(fs.readFileSync('.env'));
let key = envConfig.GOOGLE_PRIVATE_KEY;

// Remove quotes if present
if (key.startsWith('"') && key.endsWith('"')) {
  key = key.slice(1, -1);
}

// Unescape newlines
key = key.replace(/\\n/g, '\n');

// Test if it's already a valid format
const crypto = require('crypto');
try {
  const sign = crypto.createSign('RSA-SHA256');
  sign.update('test');
  sign.sign(key);
  console.log('✅ Chave já está correta!');
} catch (err) {
  console.log('❌ Chave ainda inválida, tentando normalizar espaços...');
  // Ensure correct PEM format: header, lines of 64 chars, footer
  const header = '-----BEGIN PRIVATE KEY-----';
  const footer = '-----END PRIVATE KEY-----';
  let body = key.replace(header, '').replace(footer, '').replace(/\s/g, '');
  const lines = [];
  for (let i = 0; i < body.length; i += 64) {
    lines.push(body.slice(i, i + 64));
  }
  const normalizedKey = `${header}\n${lines.join('\n')}\n${footer}\n`;
  
  try {
    const sign2 = crypto.createSign('RSA-SHA256');
    sign2.update('test');
    sign2.sign(normalizedKey);
    console.log('✅ Chave normalizada com sucesso!');
    // Update .env with the normalized key (escaped for .env)
    const escapedKey = normalizedKey.replace(/\n/g, '\\n');
    envConfig.GOOGLE_PRIVATE_KEY = `"${escapedKey}"`;
    const newEnv = Object.entries(envConfig).map(([k, v]) => `${k}=${v}`).join('\n');
    fs.writeFileSync('.env', newEnv);
    console.log('✅ .env atualizado com a chave normalizada.');
  } catch (err2) {
    console.error('❌ Falha crítica ao normalizar a chave:', err2.message);
  }
}
