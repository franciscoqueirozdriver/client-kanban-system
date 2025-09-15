/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const BASE_DIR = process.cwd();
const OUTPUT = path.join(BASE_DIR, 'estrutura_nodejs.txt');

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', 'out', '.vercel', '.cache'
]);

// Regex de arquivos “textuais” relevantes
const FILE_OK = /\.(jsx?|tsx?|json|sh)$|^Dockerfile$|^Makefile$|\.config\..*$|^\.gitignore$|^next\.config\.js$|^tsconfig\.json$|^package\.json$/i;

function isEnvFile(file) {
  const b = path.basename(file);
  return b.startsWith('.env');
}

function* walk(dir, depth = 0) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (!IGNORE_DIRS.has(ent.name)) {
        yield { type: 'dir', full, name: ent.name, depth };
        yield* walk(full, depth + 1);
      }
    } else if (ent.isFile()) {
      yield { type: 'file', full, name: ent.name, depth };
    }
  }
}

function pad(depth) { return '    '.repeat(depth); }

function writeLine(s) { fs.appendFileSync(OUTPUT, s + '\n'); }

function analyzeForKanban(readFiles) {
  const KANBAN_TERMS = [
    'Status_Kanban', 'Lead Selecionado', 'Tentativa de Contato', 'Contato Efetuado',
    'Conversa Iniciada', 'Reunião Agendada', 'Enviado Spotter', 'Perdido',
    'groupBy', 'columns', 'kanban', 'buscar', 'search'
  ];
  const kanbanRegex = new RegExp(KANBAN_TERMS.join('|'), 'i');
  const relatedFiles = new Map();

  for (const { fullPath, content } of readFiles) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (kanbanRegex.test(line)) {
        if (!relatedFiles.has(fullPath)) {
          relatedFiles.set(fullPath, []);
        }
        relatedFiles.get(fullPath).push({ lineNum: i + 1, line: line.trim() });
      }
    }
  }

  if (relatedFiles.size > 0) {
    writeLine('\n\n=================================================');
    writeLine('📊 Arquivos possivelmente relacionados ao Kanban');
    writeLine('=================================================\n');

    for (const [filePath, matches] of relatedFiles.entries()) {
      writeLine(`📄 ${filePath}`);
      for (const { lineNum, line } of matches) {
        writeLine(`    [${lineNum}]: ${line}`);
      }
      writeLine('──────────────────────────────');
    }
  }
}


function main() {
  fs.writeFileSync(OUTPUT, `📂 Estrutura do projeto – ${new Date().toISOString()}\nPasta base: ${BASE_DIR}\n──────────────────────────────\n`);
  // raiz
  writeLine(`${pad(0)}📁 ${path.basename(BASE_DIR)}`);

  const filesForAnalysis = []; // <-- To store file paths and content

  for (const item of walk(BASE_DIR, 0)) {
    const indent = pad(item.depth + 1);
    if (item.type === 'dir') {
      writeLine(`${indent}📁 ${item.name}`);
      continue;
    }
    // file
    if (FILE_OK.test(item.name)) {
      writeLine(`${indent}📄 ${item.name}`);

      if (isEnvFile(item.full)) {
        writeLine(`${indent}└── Conteúdo:`);
        writeLine(`${indent}    (conteúdo ocultado por segurança)`);
      } else {
        try {
          const content = fs.readFileSync(item.full, 'utf8');
          // Store for later analysis
          filesForAnalysis.push({ fullPath: item.full, content });

          writeLine(`${indent}└── Conteúdo:`);
          const indentedContent = content
            .split('\n')
            .map(l => `${indent}    ${l}`)
            .join('\n');
          writeLine(indentedContent);
        } catch (e) {
          writeLine(`${indent}    (erro ao ler arquivo: ${e.message})`);
        }
      }
      writeLine(`${indent}──────────────────────────────`);
    }
  }

  // After walking the tree, perform the analysis
  analyzeForKanban(filesForAnalysis);

  console.log(`✅ Inventário gerado em: ${OUTPUT}`);
}

main();
