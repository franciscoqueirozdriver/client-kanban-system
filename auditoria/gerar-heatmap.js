const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const options = {};
for (const arg of args) {
  if (arg.startsWith('--range=')) {
    options.range = arg.split('=')[1];
  } else if (arg.startsWith('--since=')) {
    options.since = arg.split('=')[1];
  } else if (arg.startsWith('--until=')) {
    options.until = arg.split('=')[1];
  }
}

const SCRIPT_DIR = __dirname;
const OUT_DIR = path.join(SCRIPT_DIR, 'out');
const commitsJsonPath = path.join(OUT_DIR, 'commits.json');

if (!fs.existsSync(commitsJsonPath)) {
  console.error('Arquivo commits.json não encontrado. Execute parse-log.js antes.');
  process.exit(1);
}

const commits = JSON.parse(fs.readFileSync(commitsJsonPath, 'utf8'));

function effectivePath(filepath) {
  if (!filepath) {
    return filepath;
  }
  const arrowIndex = filepath.lastIndexOf('=>');
  if (arrowIndex !== -1) {
    return filepath.slice(arrowIndex + 2).trim();
  }
  return filepath.trim();
}

function folderKey(filepath) {
  const cleanPath = effectivePath(filepath);
  if (!cleanPath) {
    return '[root]';
  }
  const segments = cleanPath.split('/').filter(Boolean);
  if (segments.length === 0) {
    return '[root]';
  }
  if (segments.length === 1) {
    return `${segments[0]}/`;
  }
  if (segments[0] === 'src' || segments[0] === 'lib') {
    return `${segments[0]}/${segments[1]}`;
  }
  return `${segments[0]}/`;
}

const folderMap = new Map();
const fileChurn = new Map();
let totalChurn = 0;

for (const commit of commits) {
  let commitChurn = 0;
  for (const file of commit.files) {
    const churn = Number(file.insertions || 0) + Number(file.deletions || 0);
    commitChurn += churn;

    const folder = folderKey(file.filepath);
    if (!folderMap.has(folder)) {
      folderMap.set(folder, { churn: 0, commits: new Set() });
    }
    const folderEntry = folderMap.get(folder);
    folderEntry.churn += churn;
    folderEntry.commits.add(commit.hash);

    const effective = effectivePath(file.filepath);
    if (!fileChurn.has(effective)) {
      fileChurn.set(effective, { churn: 0, insertions: 0, deletions: 0, commits: new Set() });
    }
    const fileEntry = fileChurn.get(effective);
    fileEntry.churn += churn;
    fileEntry.insertions += Number(file.insertions || 0);
    fileEntry.deletions += Number(file.deletions || 0);
    fileEntry.commits.add(commit.hash);
  }
  commit.total_churn = commitChurn;
  totalChurn += commitChurn;
}

const heatmapRows = [];
for (const [folder, data] of folderMap.entries()) {
  heatmapRows.push({
    folder,
    commits: data.commits.size,
    churn: data.churn,
  });
}

heatmapRows.sort((a, b) => b.churn - a.churn);

const heatmapCsvLines = ['pasta;commits;linhas_alteradas;percentual'];
for (const row of heatmapRows) {
  const percentage = totalChurn === 0 ? 0 : ((row.churn / totalChurn) * 100);
  heatmapCsvLines.push([
    row.folder,
    row.commits,
    row.churn,
    percentage.toFixed(2).replace('.', ','),
  ].join(';'));
}

fs.writeFileSync(path.join(OUT_DIR, 'heatmap_pastas.csv'), `${heatmapCsvLines.join('\n')}\n`, 'utf8');

function formatDate(dateIso) {
  if (!dateIso) {
    return '';
  }
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) {
    return dateIso;
  }
  return date.toISOString();
}

const summaryRange = options.range || '0230841..9bb17f5';
const totalCommits = commits.length;
const uniqueAuthors = new Set(commits.map((c) => c.author)).size;

const topFiles = Array.from(fileChurn.entries())
  .map(([filepath, data]) => ({ filepath, churn: data.churn, commits: data.commits.size }))
  .sort((a, b) => b.churn - a.churn)
  .slice(0, 10);

const redFlags = commits.filter((commit) => {
  const hasRiskyFile = commit.files.some((file) => file.flag_risco);
  return commit.breaking || hasRiskyFile;
}).map((commit) => {
  const reasons = [];
  if (commit.breaking) {
    reasons.push('BREAKING CHANGE');
  }
  if (commit.files.some((file) => file.flag_risco)) {
    reasons.push('Mudanças em áreas sensíveis');
  }
  return {
    hash: commit.hash,
    subject: commit.subject,
    author: commit.author,
    date: commit.date_iso,
    reasons,
  };
});

const timelineCandidates = commits
  .slice()
  .sort((a, b) => b.total_churn - a.total_churn);
const timelineLimit = Math.min(10, Math.max(5, timelineCandidates.length));
const timeline = timelineCandidates.slice(0, timelineLimit);

function shortHash(hash) {
  return hash ? hash.slice(0, 7) : '';
}

function formatReasons(reasons) {
  if (!reasons.length) {
    return '';
  }
  return reasons.join(' + ');
}

let markdown = `# Auditoria ${summaryRange}\n\n`;
markdown += '## Resumo\n';
markdown += `- Janela analisada: ${summaryRange}`;
if (options.since) {
  markdown += ` (desde ${options.since})`;
}
if (options.until) {
  markdown += ` (até ${options.until})`;
}
markdown += '\n';
markdown += `- Total de commits: ${totalCommits}\n`;
markdown += `- Autores únicos: ${uniqueAuthors}\n\n`;

markdown += '## Top 10 arquivos por churn\n';
if (topFiles.length === 0) {
  markdown += '- Nenhum arquivo modificado.\n\n';
} else {
  for (const file of topFiles) {
    markdown += `- ${file.filepath} — ${file.churn} linhas alteradas em ${file.commits} commits\n`;
  }
  markdown += '\n';
}

markdown += '## Heatmap por pasta\n';
if (heatmapRows.length === 0) {
  markdown += '- Nenhuma alteração registrada.\n\n';
} else {
  markdown += '| Pasta | Commits | Linhas alteradas | Percentual |\n';
  markdown += '| --- | ---: | ---: | ---: |\n';
  for (const row of heatmapRows) {
    const percentage = totalChurn === 0 ? 0 : ((row.churn / totalChurn) * 100);
    markdown += `| ${row.folder} | ${row.commits} | ${row.churn} | ${percentage.toFixed(2)}% |\n`;
  }
  markdown += '\n';
}

markdown += '## Red Flags\n';
if (redFlags.length === 0) {
  markdown += '- Nenhum commit sinalizado.\n\n';
} else {
  for (const item of redFlags) {
    markdown += `- ${shortHash(item.hash)} — ${item.subject} (${item.author}, ${formatDate(item.date)}) — ${formatReasons(item.reasons)}\n`;
  }
  markdown += '\n';
}

markdown += '## Linha do tempo (principais commits por churn)\n';
if (timeline.length === 0) {
  markdown += '- Nenhum commit disponível.\n';
} else {
  for (const commit of timeline) {
    markdown += `- ${shortHash(commit.hash)} — ${commit.subject} (${commit.author}, ${formatDate(commit.date_iso)}) — ${commit.total_churn} linhas alteradas\n`;
  }
}

fs.writeFileSync(path.join(SCRIPT_DIR, 'AUDITORIA.md'), `${markdown}\n`, 'utf8');

console.log('Heatmap e relatório gerados.');
