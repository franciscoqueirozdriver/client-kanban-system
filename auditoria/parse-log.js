const fs = require('fs');
const path = require('path');

const SCRIPT_DIR = __dirname;
const OUT_DIR = path.join(SCRIPT_DIR, 'out');

const gitLogPath = path.join(OUT_DIR, 'gitlog.txt');
const commitsFullPath = path.join(OUT_DIR, 'commits_full.txt');

if (!fs.existsSync(gitLogPath) || !fs.existsSync(commitsFullPath)) {
  console.error('Arquivos de log não encontrados. Execute run-auditoria.sh primeiro.');
  process.exit(1);
}

function parseFullCommits() {
  const content = fs.readFileSync(commitsFullPath, 'utf8');
  const lines = content.split('\n');
  const commits = new Map();
  let current = null;
  let stage = 0;
  let bodyLines = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line === '---') {
      if (current) {
        commits.set(current.hash, {
          date: current.date,
          author: current.author,
          email: current.email,
          body: bodyLines.join('\n'),
        });
      }
      current = null;
      stage = 0;
      bodyLines = [];
      continue;
    }

    if (stage === 0) {
      if (!line) {
        continue;
      }
      current = { hash: line };
      stage = 1;
      continue;
    }

    if (!current) {
      continue;
    }

    if (stage === 1) {
      current.date = line;
      stage = 2;
      continue;
    }

    if (stage === 2) {
      current.author = line;
      stage = 3;
      continue;
    }

    if (stage === 3) {
      current.email = line;
      stage = 4;
      continue;
    }

    bodyLines.push(rawLine);
  }

  return commits;
}

function normalizeNumber(value) {
  if (value === '-' || value === undefined) {
    return 0;
  }
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function detectType(subject) {
  const typeMatch = subject.match(/^(feat|fix|refactor|chore|docs|test|perf|build|ci|style)(\(.+\))?(!)?:/i);
  if (!typeMatch) {
    return { type: 'other', breaking: false };
  }
  const type = typeMatch[1].toLowerCase();
  const hasBang = Boolean(typeMatch[3]);
  return { type, breaking: hasBang };
}

function hasBreakingChange(body) {
  if (!body) {
    return false;
  }
  return /BREAKING CHANGE/i.test(body);
}

function detectRisk(filepath) {
  const riskPatterns = [
    'spotter',
    'exact',
    'services',
    'api',
    'auth',
    'lib/googleSheets',
    'oportunidades',
    'perdcomp',
  ];
  const lower = filepath.toLowerCase();
  return riskPatterns.some((pattern) => lower.includes(pattern.toLowerCase()));
}

const fullCommits = parseFullCommits();

const gitLogLines = fs.readFileSync(gitLogPath, 'utf8').split('\n');

const commits = [];
let currentCommit = null;

for (const rawLine of gitLogLines) {
  if (!rawLine) {
    continue;
  }

  const headerMatch = rawLine.match(/^([0-9a-f]{7,40})\|/);
  if (headerMatch) {
    if (currentCommit) {
      commits.push(currentCommit);
    }

    const parts = rawLine.split('|');
    const hash = parts[0];
    const dateIso = parts[1];
    const author = parts[2];
    const email = parts[3];
    const subject = parts.slice(4).join('|');

    const fullMeta = fullCommits.get(hash) || {};
    const { type, breaking } = detectType(subject);
    const breakingChange = breaking || hasBreakingChange(fullMeta.body);

    currentCommit = {
      hash,
      dateIso,
      author,
      email,
      subject,
      type,
      breaking: breakingChange,
      body: fullMeta.body || '',
      files: [],
      totalInsertions: 0,
      totalDeletions: 0,
      summaries: [],
    };
    continue;
  }

  if (!currentCommit) {
    continue;
  }

  const trimmed = rawLine.trim();

  if (/^(create|delete) mode /.test(trimmed) || /^rename /.test(trimmed) || /^mode change /.test(trimmed)) {
    currentCommit.summaries.push(trimmed);
    continue;
  }

  if (!rawLine.includes('\t')) {
    continue;
  }

  const columns = rawLine.split('\t');
  if (columns.length < 3) {
    continue;
  }

  const insertions = normalizeNumber(columns[0]);
  const deletions = normalizeNumber(columns[1]);
  const filepathRaw = columns.slice(2).join('\t');
  const fileEntry = {
    filepath: filepathRaw,
    insertions,
    deletions,
    status: 'M',
  };
  currentCommit.files.push(fileEntry);
  currentCommit.totalInsertions += insertions;
  currentCommit.totalDeletions += deletions;
}

if (currentCommit) {
  commits.push(currentCommit);
}

function applySummaries() {
  for (const commit of commits) {
    if (!commit.summaries.length) {
      continue;
    }
    for (const summary of commit.summaries) {
      if (summary.startsWith('create mode ')) {
        const parts = summary.split(/\s+/);
        const file = parts.slice(3).join(' ');
        const target = commit.files.find((f) => f.filepath === file);
        if (target) {
          target.status = 'A';
        }
        continue;
      }
      if (summary.startsWith('delete mode ')) {
        const parts = summary.split(/\s+/);
        const file = parts.slice(3).join(' ');
        const target = commit.files.find((f) => f.filepath === file);
        if (target) {
          target.status = 'D';
        } else {
          commit.files.push({
            filepath: file,
            insertions: 0,
            deletions: 0,
            status: 'D',
          });
        }
        continue;
      }
      if (summary.startsWith('rename ')) {
        const match = summary.match(/^rename\s+(.*?)\s+=>\s+(.*?)\s*(\(.*\))?$/);
        if (match) {
          const oldPath = match[1];
          const newPath = match[2];
          const combined = `${oldPath} => ${newPath}`;
          const target = commit.files.find((f) => f.filepath === combined);
          if (target) {
            target.status = 'R';
          } else {
            const renameTarget = commit.files.find((f) => f.filepath === newPath);
            if (renameTarget) {
              renameTarget.status = 'R';
              renameTarget.filepath = combined;
            } else {
              commit.files.push({
                filepath: combined,
                insertions: 0,
                deletions: 0,
                status: 'R',
              });
            }
          }
        }
        continue;
      }
    }
  }
}

applySummaries();

for (const commit of commits) {
  for (const file of commit.files) {
    file.flag_risco = detectRisk(file.filepath);
  }
}

const commitsOutput = commits.map((commit) => ({
  hash: commit.hash,
  date_iso: commit.dateIso,
  author: commit.author,
  email: commit.email,
  subject: commit.subject,
  type: commit.type,
  breaking: commit.breaking,
  body: commit.body,
  total_insertions: commit.totalInsertions,
  total_deletions: commit.totalDeletions,
  files: commit.files.map((file) => ({
    filepath: file.filepath,
    insertions: file.insertions,
    deletions: file.deletions,
    status: file.status,
    flag_risco: file.flag_risco,
  })),
}));

const commitsCsvLines = [
  'hash;data_iso;autor;email;subject;type;breaking;arquivos;insercoes;remocoes',
];

for (const commit of commitsOutput) {
  const line = [
    commit.hash,
    commit.date_iso,
    commit.author,
    commit.email,
    commit.subject.replace(/\r?\n/g, ' ').replace(/;/g, ','),
    commit.type,
    commit.breaking,
    commit.files.length,
    commit.total_insertions,
    commit.total_deletions,
  ].join(';');
  commitsCsvLines.push(line);
}

fs.writeFileSync(path.join(OUT_DIR, 'commits.csv'), `${commitsCsvLines.join('\n')}\n`, 'utf8');
fs.writeFileSync(path.join(OUT_DIR, 'commits.json'), `${JSON.stringify(commitsOutput, null, 2)}\n`, 'utf8');

const filesCsvLines = ['hash;filepath;insertions;deletions;status;flag_risco'];

for (const commit of commitsOutput) {
  for (const file of commit.files) {
    const sanitizedPath = file.filepath.replace(/\r?\n/g, ' ');
    filesCsvLines.push([
      commit.hash,
      sanitizedPath,
      file.insertions,
      file.deletions,
      file.status,
      file.flag_risco,
    ].join(';'));
  }
}

fs.writeFileSync(path.join(OUT_DIR, 'files.csv'), `${filesCsvLines.join('\n')}\n`, 'utf8');

console.log(`Processados ${commitsOutput.length} commits.`);
