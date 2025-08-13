const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const outputFile = path.join(rootDir, 'estrutura_com_conteudo.txt');

// extensões incluídas
const includeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.txt', '.css', '.html', '.env', '.sh'];
// diretórios a ignorar
const ignoreDirs = new Set(['node_modules', '.git', '.next', 'dist', 'build']);

function listarArquivos(dir, prefix = '') {
  let resultado = '';
  const itens = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of itens) {
    if (ignoreDirs.has(item.name)) continue;

    const caminho = path.join(dir, item.name);
    if (item.isDirectory()) {
      resultado += `${prefix}[DIR] ${item.name}\n`;
      resultado += listarArquivos(caminho, prefix + '  ');
    } else {
      resultado += `${prefix}${item.name}\n`;
      const ext = path.extname(item.name).toLowerCase();
      if (includeExtensions.includes(ext) || item.name === '.gitignore') {
        try {
          const conteudo = fs.readFileSync(caminho, 'utf8');
          resultado += `${prefix}--- INÍCIO ${item.name} ---\n${conteudo}\n${prefix}--- FIM ${item.name} ---\n`;
        } catch (err) {
          resultado += `${prefix}(Erro ao ler conteúdo)\n`;
        }
      }
    }
  }
  return resultado;
}

const estrutura = listarArquivos(rootDir);
fs.writeFileSync(outputFile, estrutura, 'utf8');
console.log(`Estrutura e conteúdos salvos em: ${outputFile}`);
