import { getSheetsClient } from '../../lib/googleSheets';
import { padCNPJ14, isValidCNPJ } from '../../utils/cnpj';

const lastColLetter = (n) => { let s = ''; while (n >= 0) { s = String.fromCharCode((n % 26) + 65) + s; n = Math.floor(n / 26) - 1; } return s; };
const toStr = (v) => (v ?? '').toString();

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function jitter(base) { return Math.round(base * (0.8 + Math.random() * 0.4)); }
async function withRetry(fn, attempts = 3, delays = [1500, 3000, 5000]) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const st = e?.status || e?.response?.status || 0;
      const retryable = st >= 500 || st === 0;
      if (!retryable || i === attempts - 1) throw e;
      await sleep(jitter(delays[i] || 2000));
    }
  }
  throw last;
}

function todayISO() { return new Date().toISOString().slice(0, 10); }
function addYears(iso, yrs) { const d = new Date(iso); d.setFullYear(d.getFullYear() + yrs); return d.toISOString().slice(0, 10); }

export default async function handler(req, res) {
  const debug = String(req.query?.debug ?? req.body?.debug ?? '') === '1';
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.SPREADSHEET_ID;
    const clienteId = toStr(req.body?.Cliente_ID ?? req.query?.Cliente_ID ?? '').trim();
    const cnpjRaw = req.body?.cnpj ?? req.query?.cnpj ?? '';
    const cnpj = padCNPJ14(cnpjRaw);
    const force = String(req.body?.force ?? req.query?.force ?? '') === 'true';

    if (!isValidCNPJ(cnpj)) {
      const payload = {
        ok: false,
        mode: 'error',
        httpStatus: 400,
        httpStatusText: 'Bad Request',
        providerCode: null,
        providerMessage: 'CNPJ inválido',
        reason: 'local_validation',
        cnpj,
      };
      if (debug) payload.debug = { reason: 'local_validation' };
      return res.status(200).json(payload);
    }

    const head = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'PEREDCOMP!1:1' });
    const headers = head.data.values?.[0] || [];
    const endLetter = lastColLetter(headers.length - 1 || 0);
    const rangeRows = `PEREDCOMP!A2:${endLetter || 'Z'}`;
    const bodyRows = await sheets.spreadsheets.values.get({ spreadsheetId, range: rangeRows });
    const rows = bodyRows.data.values || [];

    const col = (name) => headers.indexOf(name);
    const idx = {
      cliente: col('Cliente_ID'),
      nome: col('Nome da Empresa'),
      cnpj: col('CNPJ'),
      qtd: col('Quantidade_PERDCOMP'),
      html: col('URL_Comprovante_HTML'),
      dt: col('Data_Consulta'),
      perd: col('Perdcomp_ID'),
      tipo: col('Tipo_Pedido'),
      sit: col('Situacao'),
      p1: col('Periodo_Inicio'),
      p2: col('Periodo_Fim'),
      proc: col('Numero_Processo'),
      proto: col('Data_Protocolo'),
      updt: col('Ultima_Atualizacao'),
    };

    const found = rows.find(r =>
      (clienteId && r[idx.cliente] === clienteId) ||
      (cnpj && padCNPJ14(r[idx.cnpj] || '') === cnpj)
    );

    if (found && !force) {
      const payload = {
        ok: true,
        mode: 'cache',
        header: { requested_at: found[idx.dt] || null },
        mappedCount: null,
        total_perdcomp: Number(found[idx.qtd] || 0) || 0,
        site_receipt: found[idx.html] || null,
        primeiro: {
          perdcomp: found[idx.perd] || '',
          tipo_documento: found[idx.tipo] || '',
          situacao: found[idx.sit] || '',
          periodo_inicio: found[idx.p1] || '',
          periodo_fim: found[idx.p2] || '',
          numero_processo: found[idx.proc] || '',
          data_transmissao: found[idx.proto] || '',
          situacao_detalhamento: found[idx.updt] || '',
        },
        cnpj,
      };
      if (debug) payload.debug = { reason: 'cache_hit' };
      return res.status(200).json(payload);
    }

    let data_fim = toStr(req.body?.data_fim ?? req.query?.data_fim ?? '').slice(0, 10);
    let data_inicio = toStr(req.body?.data_inicio ?? req.query?.data_inicio ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data_fim)) data_fim = todayISO();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data_inicio)) data_inicio = addYears(data_fim, -5);
    if (new Date(data_inicio) > new Date(data_fim)) data_inicio = addYears(data_fim, -5);

    const INFOSIMPLES_URL = process.env.INFOSIMPLES_URL;
    if (!INFOSIMPLES_URL) {
      if (found) {
        const payload = {
          ok: true,
          mode: 'fallback',
          warning: {
            httpStatus: 503,
            httpStatusText: 'Service Unavailable',
            providerCode: null,
            providerMessage: 'INFOSIMPLES_URL ausente',
          },
          header: { requested_at: found[idx.dt] || null },
          mappedCount: null,
          total_perdcomp: Number(found[idx.qtd] || 0) || 0,
          site_receipt: found[idx.html] || null,
          primeiro: {},
          cnpj,
        };
        if (debug) payload.debug = { reason: 'missing_api_url' };
        return res.status(200).json(payload);
      }
      const payload = {
        ok: false,
        mode: 'error',
        httpStatus: 503,
        httpStatusText: 'Service Unavailable',
        providerCode: null,
        providerMessage: 'INFOSIMPLES_URL ausente',
        reason: 'missing_api_url',
        cnpj,
      };
      if (debug) payload.debug = { reason: 'missing_api_url' };
      return res.status(200).json(payload);
    }

    const doCall = async () => {
      const resp = await fetch(INFOSIMPLES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ cnpj, data_inicio, data_fim, timeout: 600 }),
      });
      const text = await resp.text();
      const json = (() => { try { return JSON.parse(text); } catch { return null; } })();
      if (!resp.ok || (json && typeof json.code === 'number' && json.code !== 200)) {
        const err = new Error('provider_error');
        err.status = resp.status || 502;
        err.statusText = resp.statusText || 'Bad Gateway';
        err.providerCode = json?.code ?? null;
        err.providerMessage = json?.code_message || json?.message || json?.errors?.[0]?.message || null;
        throw err;
      }
      return json;
    };

    let body;
    try {
      body = await withRetry(doCall, 3, [1500, 3000, 5000]);
    } catch (err) {
      if (found) {
        const payload = {
          ok: true,
          mode: 'fallback',
          warning: {
            httpStatus: err?.status || 502,
            httpStatusText: err?.statusText || 'Bad Gateway',
            providerCode: err?.providerCode ?? null,
            providerMessage: err?.providerMessage ?? 'API error',
          },
          header: { requested_at: found[idx.dt] || null },
          mappedCount: null,
          total_perdcomp: Number(found[idx.qtd] || 0) || 0,
          site_receipt: found[idx.html] || null,
          primeiro: {},
          cnpj,
        };
        if (debug) payload.debug = { reason: 'fallback_from_sheet' };
        return res.status(200).json(payload);
      }
      const payload = {
        ok: false,
        mode: 'error',
        httpStatus: err?.status || 502,
        httpStatusText: err?.statusText || 'Bad Gateway',
        providerCode: err?.providerCode ?? null,
        providerMessage: err?.providerMessage ?? 'API error',
        reason: 'api_failure_no_fallback',
        cnpj,
      };
      if (debug) payload.debug = { reason: 'api_failure_no_fallback' };
      return res.status(200).json(payload);
    }

    const mappedCount = body?.mappedCount ?? 0;
    const arr = body?.data?.[0]?.perdcomp || [];
    const total = Array.isArray(arr) ? arr.length : 0;
    const primeiro = arr?.[0] || {};
    const site_receipt = body?.site_receipts?.[0] || null;
    const requested_at = body?.header?.requested_at || null;

    const updated = found ? [...found] : new Array(headers.length).fill('');
    const setIf = (pos, val) => {
      if (pos < 0) return;
      const cur = toStr(updated[pos] ?? '');
      const nxt = toStr(val ?? '');
      updated[pos] = nxt || cur;
    };

    setIf(idx.qtd, total);
    setIf(idx.html, site_receipt);
    setIf(idx.dt, requested_at);
    setIf(idx.perd, primeiro?.perdcomp);
    setIf(idx.tipo, primeiro?.tipo_documento);
    setIf(idx.sit, primeiro?.situacao);
    setIf(idx.p1, primeiro?.periodo_inicio);
    setIf(idx.p2, primeiro?.periodo_fim);
    setIf(idx.proc, primeiro?.numero_processo);
    setIf(idx.proto, primeiro?.data_transmissao);
    setIf(idx.updt, primeiro?.situacao_detalhamento);

    if (found) {
      while (updated.length < headers.length) updated.push('');
      const rowIndex = rows.indexOf(found);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `PEREDCOMP!A${rowIndex + 2}:${endLetter}${rowIndex + 2}`,
        valueInputOption: 'RAW',
        requestBody: { values: [updated.slice(0, headers.length)] },
      });
    } else {
      updated[idx.cliente] = clienteId || '';
      updated[idx.cnpj] = cnpj;
      updated[idx.nome] = toStr(req.body?.nomeEmpresa ?? req.query?.nomeEmpresa ?? '');
      while (updated.length < headers.length) updated.push('');
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'PEREDCOMP!A1',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [updated.slice(0, headers.length)] },
      });
    }

    const payload = {
      ok: true,
      mode: 'live',
      header: { requested_at },
      mappedCount,
      total_perdcomp: total,
      site_receipt,
      primeiro,
      cnpj,
    };
    if (debug) payload.debug = { reason: 'live', apiResponse: body, mappedCount, siteReceipts: body?.site_receipts, header: body?.header };
    return res.status(200).json(payload);

  } catch (err) {
    const payload = {
      ok: false,
      mode: 'error',
      httpStatus: 500,
      httpStatusText: 'Internal Server Error',
      providerCode: null,
      providerMessage: String(err?.message || err),
      reason: 'unexpected',
    };
    if (debug) payload.debug = { reason: 'unexpected' };
    return res.status(200).json(payload);
  }
}

