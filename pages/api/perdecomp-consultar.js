import { getSheetsClient } from '../../lib/googleSheets';
import { padCNPJ14, isValidCNPJ } from '../../utils/cnpj';

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function jitter(base){ return Math.round(base*(0.8+Math.random()*0.4)); }
async function withRetry(fn, attempts=3, delays=[1500,3000,5000]){
  let last; for(let i=0;i<attempts;i++){
    try{ return await fn(); }catch(e){
      last=e; const st=e?.status||e?.response?.status||0;
      if(!(st>=500||st===0) || i===attempts-1) throw e;
      await sleep(jitter(delays[i]||2000));
    }
  } throw last;
}

function todayISO(){ return new Date().toISOString().slice(0,10); }
function addYears(iso, yrs){ const d=new Date(iso); d.setFullYear(d.getFullYear()+yrs); return d.toISOString().slice(0,10); }

export default async function handler(req,res){
  try{
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.SPREADSHEET_ID;

    const clienteId = (req.body?.Cliente_ID ?? req.query?.Cliente_ID ?? '').toString().trim();
    const cnpjRaw = req.body?.cnpj ?? req.query?.cnpj ?? '';
    const cnpj = padCNPJ14(cnpjRaw);
    const force = String(req.body?.force ?? req.query?.force ?? '') === 'true';

    // 1) Cache da planilha
    const head = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'PEREDCOMP!1:1' });
    const headers = head.data.values?.[0] || [];
    const col = (name)=> headers.indexOf(name);
    const lastColLetter = (n)=>{ let s=''; while(n>=0){ s=String.fromCharCode((n%26)+65)+s; n=Math.floor(n/26)-1; } return s; };
    const end = lastColLetter(headers.length-1);
    const bodyRows = await sheets.spreadsheets.values.get({ spreadsheetId, range: `PEREDCOMP!A2:${end}` });
    const rows = bodyRows.data.values || [];
    const idx = {
      cliente: col('Cliente_ID'),
      cnpj: col('CNPJ'),
      nome: col('Nome da Empresa'),
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
      (cnpj && (r[idx.cnpj]||'').replace(/\D/g,'').padStart(14,'0') === cnpj)
    );

    if (found && !force){
      // devolve cache
      return res.status(200).json({
        ok: true,
        mode: 'cache',
        header: { requested_at: found[idx.dt] || null },
        mappedCount: null,
        total_perdcomp: Number(found[idx.qtd]||0) || 0,
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
        cnpj
      });
    }

    // 2) Necessita API
    if (!isValidCNPJ(cnpj)) {
      return res.status(400).json({ error:true, httpStatus:400, httpStatusText:'Bad Request', providerCode:null, providerMessage:'CNPJ inválido' });
    }

    let data_fim = (req.body?.data_fim ?? req.query?.data_fim ?? '').toString().slice(0,10);
    let data_inicio = (req.body?.data_inicio ?? req.query?.data_inicio ?? '').toString().slice(0,10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data_fim)) data_fim = todayISO();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data_inicio)) data_inicio = addYears(data_fim, -5);
    if (new Date(data_inicio) > new Date(data_fim)) data_inicio = addYears(data_fim, -5);

    const INFOSIMPLES_URL = process.env.INFOSIMPLES_URL;
    const doCall = async ()=>{
      const resp = await fetch(INFOSIMPLES_URL, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'Accept':'application/json' },
        body: JSON.stringify({ cnpj, data_inicio, data_fim, timeout: 600 }),
      });
      const text = await resp.text();
      const json = (()=>{ try { return JSON.parse(text); } catch { return null; }})();
      if (!resp.ok || (json && typeof json.code==='number' && json.code!==200)) {
        const err = new Error('provider_error');
        err.status = resp.status || 502;
        err.statusText = resp.statusText || 'Bad Gateway';
        err.providerCode = json?.code;
        err.providerMessage = json?.code_message || json?.message || json?.errors?.[0]?.message || null;
        throw err;
      }
      return json;
    };

    let body;
    try{
      body = await withRetry(doCall, 3, [1500,3000,5000]);
    }catch(err){
      const fallback = found ? {
        quantidade: Number(found[idx.qtd]||0)||0,
        site_receipt: found[idx.html]||null,
        requested_at: found[idx.dt]||null
      } : null;

      if (fallback) {
        return res.status(200).json({
          ok: true,
          mode: 'fallback',
          warning: {
            httpStatus: err?.status || 502,
            httpStatusText: err?.statusText || 'Bad Gateway',
            providerCode: err?.providerCode ?? null,
            providerMessage: err?.providerMessage ?? 'API error',
          },
          header: { requested_at: fallback.requested_at },
          mappedCount: null,
          total_perdcomp: fallback.quantidade,
          site_receipt: fallback.site_receipt,
          primeiro: {},
          cnpj
        });
      }

      return res.status(err?.status || 502).json({
        error:true,
        httpStatus: err?.status || 502,
        httpStatusText: err?.statusText || 'Bad Gateway',
        providerCode: err?.providerCode ?? null,
        providerMessage: err?.providerMessage ?? 'API error'
      });
    }

    // 3) sucesso: parse
    const mappedCount = body?.mappedCount ?? 0;
    const arr = body?.data?.[0]?.perdcomp || [];
    const total = Array.isArray(arr) ? arr.length : 0;
    const primeiro = arr?.[0] || {};
    const site_receipt = body?.site_receipts?.[0] || null;
    const requested_at = body?.header?.requested_at || null;

    // 4) upsert planilha
    const toVal = (v) => (v ?? '').toString();
    const updated = { ...found };

    const setIf = (pos, val) => {
      if (pos<0) return;
      const cur = toVal(found?.[pos] ?? '');
      const nxt = toVal(val ?? '');
      updated[pos] = nxt || cur; // não sobrescrever com vazio
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

    if (found){
      const rowIndex = rows.indexOf(found); // 0-based dentro do range
      const values = [...updated];
      while(values.length < headers.length) values.push('');
      await sheets.spreadsheets.values.update({
        spreadsheetId, range: `PEREDCOMP!A${rowIndex+2}:${end}${rowIndex+2}`,
        valueInputOption:'RAW', requestBody:{ values:[values.slice(0, headers.length)] }
      });
    } else {
      const record = new Array(headers.length).fill('');
      record[idx.cliente] = clienteId || '';
      record[idx.cnpj] = cnpj;
      record[idx.nome] = (req.body?.nomeEmpresa ?? req.query?.nomeEmpresa ?? '').toString();
      record[idx.qtd] = String(total);
      record[idx.html] = site_receipt || '';
      record[idx.dt] = requested_at || '';
      record[idx.perd] = primeiro?.perdcomp || '';
      record[idx.tipo] = primeiro?.tipo_documento || '';
      record[idx.sit] = primeiro?.situacao || '';
      record[idx.p1] = primeiro?.periodo_inicio || '';
      record[idx.p2] = primeiro?.periodo_fim || '';
      record[idx.proc] = primeiro?.numero_processo || '';
      record[idx.proto] = primeiro?.data_transmissao || '';
      record[idx.updt] = primeiro?.situacao_detalhamento || '';
      await sheets.spreadsheets.values.append({
        spreadsheetId, range:'PEREDCOMP!A1', valueInputOption:'RAW',
        insertDataOption:'INSERT_ROWS', requestBody:{ values:[record] }
      });
    }

    return res.status(200).json({
      ok:true, mode:'live',
      header:{ requested_at },
      mappedCount, total_perdcomp: total,
      site_receipt, primeiro, cnpj
    });

  }catch(err){
    return res.status(500).json({ error:true, httpStatus:500, httpStatusText:'Internal Server Error', message: String(err?.message||err) });
  }
}
