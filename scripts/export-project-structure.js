const fs = require('fs');
const path = require('path');

const IGNORE = new Set(['node_modules', '.next', '.git', 'dist', '.turbo', 'build', '.vercel', 'project-structure.txt']);
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.env.example', '.md', '.css', '.html']);
const MAX_LINES = 500;

function walk(dir, prefix = '') {
  let tree = '';
  const items = fs.readdirSync(dir).filter(f => !IGNORE.has(f)).sort();
  for (const item of items) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      tree += `${prefix}${item}/\n`;
      tree += walk(full, prefix + '  ');
    } else {
      tree += `${prefix}${item}\n`;
    }
  }
  return tree;
}

function collectFiles(dir, root) {
  let output = '';
  const items = fs.readdirSync(dir).filter(f => !IGNORE.has(f)).sort();
  for (const item of items) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      output += collectFiles(full, root);
    } else {
      const ext = path.extname(item);
      if (EXTENSIONS.has(ext) || item === '.gitignore' || item.startsWith('next.config') || item === '.env.example') {
        const rel = path.relative(root, full);
        let content = fs.readFileSync(full, 'utf-8');
        const lines = content.split('\n');
        if (lines.length > MAX_LINES) {
          content = lines.slice(0, MAX_LINES).join('\n') + '\n[... truncado]';
        }
        output += `\n--- ${rel} ---\n${content}\n`;
      }
    }
  }
  return output;
}

const root = process.cwd();
console.log('Generating project structure...');

let result = '=== ESTRUTURA DE DIRETÓRIOS ===\n';
result += walk(root);
result += '\n=== CONTEÚDO DOS ARQUIVOS ===\n';
result += collectFiles(root, root);

fs.writeFileSync('project-structure.txt', result, 'utf-8');
console.log('Done! saved to project-structure.txt');
