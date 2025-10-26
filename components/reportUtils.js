// components/reportUtils.js
import { getColumnName } from '../lib/googleSheets';

export function normalizePhones(row, idx) {
  const val = (i) => (i >= 0 ? String(row[i] || '').trim() : '');
  const existing = val(idx.normalizado);
  const rawList = [
    val(idx.phoneWork),
    val(idx.phoneHome),
    val(idx.phoneMobile),
    val(idx.phoneOther),
    val(idx.tel),
    val(idx.cel),
  ];

  if (existing) {
    return existing
      .split(';')
      .map((p) => p.trim())
      .filter(Boolean);
  }

  const numbers = rawList
    .map((p) => p.replace(/[\s().-]/g, ''))
    .map((p) => p.replace(/^0+/, ''))
    .map((p) => p.replace(/[^0-9+]/g, ''))
    .filter(Boolean)
    .map((p) => {
      if (p.startsWith('+')) p = p.slice(1);
      if (!p.startsWith('55')) {
        if (p.length === 10 || p.length === 11) p = '55' + p;
        else return null;
      }
      if (p.length === 12 || p.length === 13) return '+' + p;
      return null;
    })
    .filter(Boolean);

  return Array.from(new Set(numbers));
}

export function buildReport(rows) {
  const [header, ...data] = rows;
  
  // ✅ Usar nomes normalizados para buscar índices
  const orgCol = getColumnName('Organização - Nome');
  const segmentoCol = getColumnName('Organização - Segmento');
  const tamanhoCol = getColumnName('Organização - Tamanho da empresa');
  const contatoCol = getColumnName('Negócio - Pessoa de contato');
  const cargoCol = getColumnName('Pessoa - Cargo');
  const phoneWorkCol = getColumnName('Pessoa - Phone - Work');
  const phoneHomeCol = getColumnName('Pessoa - Phone - Home');
  const phoneMobileCol = getColumnName('Pessoa - Phone - Mobile');
  const phoneOtherCol = getColumnName('Pessoa - Phone - Other');
  const telCol = getColumnName('Pessoa - Telefone');
  const celCol = getColumnName('Pessoa - Celular');
  const normalizadoCol = getColumnName('Telefone Normalizado');
  const emailCol = getColumnName('Pessoa - Email - Work');
  const linkedinCol = getColumnName('Pessoa - End. Linkedin');
  const ufCol = getColumnName('uf');
  const cidadeCol = getColumnName('cidade_estimada');
  const impressoCol = getColumnName('Impresso_Lista');
  
  const idx = {
    org: header.indexOf(orgCol),
    segmento: header.indexOf(segmentoCol),
    tamanho: header.indexOf(tamanhoCol),
    contato: header.indexOf(contatoCol),
    cargo: header.indexOf(cargoCol),
    phoneWork: header.indexOf(phoneWorkCol),
    phoneHome: header.indexOf(phoneHomeCol),
    phoneMobile: header.indexOf(phoneMobileCol),
    phoneOther: header.indexOf(phoneOtherCol),
    tel: header.indexOf(telCol),
    cel: header.indexOf(celCol),
    normalizado: header.indexOf(normalizadoCol),
    email: header.indexOf(emailCol),
    linkedin: header.indexOf(linkedinCol),
    uf: header.indexOf(ufCol),
    cidade: header.indexOf(cidadeCol),
    impresso: header.indexOf(impressoCol),
  };

  const normalizePhone = (v) => String(v || '').trim();

  if (idx.tel === -1 || idx.cel === -1) {
    console.warn('Colunas de telefone não encontradas', { tel: idx.tel, cel: idx.cel });
  }

  const filters = {
    segmento: new Set(),
    porte: new Set(),
    uf: new Set(),
    cidade: new Set(),
  };

  const map = new Map();
  data.forEach((row, i) => {
    const company = row[idx.org];
    if (!company) return;
    if (row[idx.impresso]) return;

    if (!map.has(company)) {
      map.set(company, {
        company,
        segment: row[idx.segmento] || '',
        size: row[idx.tamanho] || '',
        uf: row[idx.uf] || '',
        cidade: row[idx.cidade] || '',
        contacts: [],
        rows: [],
      });
    }
    const item = map.get(company);
    item.rows.push(i + 2);

    const telefone = normalizePhone(row[idx.tel]);
    const celular = normalizePhone(row[idx.cel]);
    const normalizedPhones = normalizePhones(row, idx);
    if (normalizedPhones.length === 0) {
      console.warn('Contato sem telefone', { row: i + 2, company });
    }

    item.contacts.push({
      nome: (row[idx.contato] || '').trim(),
      cargo: (row[idx.cargo] || '').trim(),
      telefone,
      celular,
      normalizedPhones,
      email: (row[idx.email] || '').trim(),
      linkedin: (row[idx.linkedin] || '').trim(),
    });

    if (row[idx.segmento]) filters.segmento.add(row[idx.segmento]);
    if (row[idx.tamanho]) filters.porte.add(row[idx.tamanho]);
    if (row[idx.uf]) filters.uf.add(row[idx.uf]);
    if (row[idx.cidade]) filters.cidade.add(row[idx.cidade]);
  });

  return { map, filters };
}

export function mapToRows(map, query = {}, max = Infinity) {
  const result = [];
  const toMark = new Set();

  map.forEach((item) => {
    if (query.segmento && item.segment !== query.segmento) return;
    if (query.porte && item.size !== query.porte) return;
    if (query.uf && item.uf !== query.uf) return;
    if (query.cidade && item.cidade !== query.cidade) return;

    if (result.length >= max) return;

    if (item.contacts.length === 0) {
      result.push({
        company: item.company,
        segment: item.segment,
        size: item.size,
        nome: '',
        cargo: '',
        telefone: '',
        celular: '',
        normalizedPhones: [],
        email: '',
        linkedin: '',
      });
    } else {
      item.contacts.forEach((c) => {
        if (result.length >= max) return;
        result.push({
          company: item.company,
          segment: item.segment,
          size: item.size,
          nome: c.nome,
          cargo: c.cargo,
          telefone: c.telefone,
          celular: c.celular,
          email: c.email,
          linkedin: c.linkedin,
          normalizedPhones: c.normalizedPhones || [],
        });
      });
    }
    item.rows.forEach((r) => toMark.add(r));
  });

  return { rows: result, toMark };
}

export async function markPrintedRows(updateRowFn, rows) {
  await Promise.all(
    Array.from(rows).map((rowNum) => updateRowFn(rowNum, { impresso_lista: 'Em Lista' }))
  );
}

