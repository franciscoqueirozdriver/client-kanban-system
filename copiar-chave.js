import fs from 'fs';
import path from 'path';
import clipboardy from 'clipboardy';

// Caminho do arquivo .env.local
const envPath = path.resolve('.env.local');

// Ler o arquivo .env.local
const content = fs.readFileSync(envPath, 'utf8');

// Encontrar a linha com GOOGLE_PRIVATE_KEY
const match = content.match(/^GOOGLE_PRIVATE_KEY=(["']?)([\s\S]*?)\1$/m);

if (!match) {
  console.error('❌ GOOGLE_PRIVATE_KEY não encontrada no .env.local');
  process.exit(1);
}

let key = match[2];

// Se tiver aspas, remove
key = key.replace(/^"|"$/g, '');

// Ajustar quebras de linha para \n
const fixedKey = key.replace(/\n/g, '\\n');

// Copiar para área de transferência
clipboardy.writeSync(fixedKey);

console.log('✅ Chave copiada para a área de transferência no formato correto.');
console.log('Cole no painel de variáveis com:');
console.log(`"-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"`);

