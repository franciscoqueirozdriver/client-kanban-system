import { NextResponse } from 'next/server';
import { listFunnels, listStages, SPOTTER_BASE_URL } from '@/lib/exactSpotter';
import { getSpotterToken } from '@/lib/spotter-env';
const { validateSpotterLead } = require('../../../../validators/spotterLead');

const digits = (value) => String(value ?? '').replace(/\D+/g, '');
const clean = (object) =>
  Object.fromEntries(
    Object.entries(object ?? {}).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return String(value)
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizePhone = (rawPhone, rawDdi) => {
  const phoneDigits = digits(rawPhone);
  let phone = phoneDigits;
  let ddi = digits(rawDdi) || undefined;

  if (!phone) {
    return { ddi: undefined, phone: undefined };
  }

  if (!ddi && phone.startsWith('55') && phone.length > 11) {
    ddi = '55';
    phone = phone.slice(2);
  }

  if (phone.length >= 10 && phone.startsWith('0')) {
    phone = phone.slice(1);
  }

  if (!ddi && phone) {
    ddi = '55';
  }

  return { ddi, phone };
};

let pipelinesCache = { expiresAt: 0, value: { pipelines: [] } };

async function getPipelinesCached() {
  const now = Date.now();
  if (pipelinesCache.expiresAt > now && pipelinesCache.value) {
    return pipelinesCache.value;
  }

  const [funnels, stages] = await Promise.all([listFunnels(), listStages()]);
  const stagesByFunnel = new Map();

  stages.forEach((stage) => {
    const funnelId = Number(stage?.funnelId);
    const name = String(stage?.value ?? stage?.name ?? '').trim();
    if (!Number.isFinite(funnelId) || !name) return;

    const id = Number(stage?.id);
    const position = Number(stage?.position ?? 0) || 0;

    const entry = stagesByFunnel.get(funnelId) ?? [];
    entry.push({ id: Number.isFinite(id) ? id : undefined, name, position });
    stagesByFunnel.set(funnelId, entry);
  });

  const pipelines = funnels
    .map((funnel) => {
      const id = Number(funnel?.id);
      if (!Number.isFinite(id)) return null;

      const name = String(funnel?.value ?? funnel?.name ?? '').trim() || `Funil ${id}`;
      const stageEntries = (stagesByFunnel.get(id) ?? []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      const seenNames = new Set();
      const stageNames = stageEntries
        .map((stage) => stage.name)
        .filter((stageName) => {
          if (!stageName || seenNames.has(stageName)) return false;
          seenNames.add(stageName);
          return true;
        });

      return {
        id,
        name,
        stageNames,
        stages: stageEntries.map(({ id: stageId, name: stageName }) => ({
          id: stageId,
          name: stageName,
        })),
      };
    })
    .filter(Boolean);

  pipelinesCache = {
    expiresAt: now + 5 * 60 * 1000,
    value: { pipelines },
  };

  return pipelinesCache.value;
}

const json = (payload, status = 200) => NextResponse.json(payload, { status });
const badRequest = (message, extras = {}) => json({ error: message, ...extras }, 400);

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));

    const base = {
      nomeLead: body?.nomeLead ?? body?.name ?? '',
      origem: body?.origem ?? body?.source ?? '',
      mercado: body?.mercado ?? body?.industry ?? '',
      pais: body?.pais ?? body?.country ?? '',
      estado: body?.estado ?? body?.state ?? '',
      cidade: body?.cidade ?? body?.city ?? '',
      telefones: body?.telefones ?? body?.phone ?? '',
      nomeContato: body?.nomeContato ?? body?.contactName ?? '',
      telefonesContato: body?.telefonesContato ?? '',
      emailContato: body?.emailContato ?? '',
      tipoServCom: body?.tipoServCom ?? body?.tipoServComunicacao ?? '',
      idServCom: body?.idServCom ?? body?.idServComunicacao ?? '',
      area: body?.area ?? '',
      modalidade: body?.modalidade ?? '',
      funilId: body?.funilId ?? body?.funnelId ?? null,
      etapaNome: body?.etapaNome ?? body?.stage ?? null,
      address: body?.address ?? body?.logradouro ?? '',
      addressNumber: body?.addressNumber ?? body?.numero ?? '',
      addressComplement: body?.addressComplement ?? body?.complemento ?? '',
      neighborhood: body?.neighborhood ?? body?.bairro ?? '',
      zipcode: body?.zipcode ?? body?.cep ?? '',
      subOrigem: body?.subOrigem ?? body?.subSource ?? '',
      observacao: body?.observacao ?? body?.description ?? '',
    };

    const funnelId = Number(body?.funnelId ?? body?.funilId ?? base.funilId);
    if (!Number.isFinite(funnelId)) {
      const message = 'funnelId inválido: envie o ID numérico do funil';
      return badRequest(message, {
        fieldErrors: { funnelId: ['Envie o ID numérico do funil'] },
        messages: [message],
      });
    }

    const catalog = await getPipelinesCached();
    const { pipelines } = catalog;
    const pipeline = pipelines.find((item) => item.id === funnelId);
    if (!pipeline) {
      const message = `Funil ID ${funnelId} não encontrado no catálogo`;
      return badRequest(message, {
        fieldErrors: { funnelId: [message] },
        messages: [message],
      });
    }

    const stageStringCandidates = [body?.stage, body?.stageName, body?.etapaNome, body?.etapa, base.etapaNome]
      .map((value) => (value == null ? '' : String(value).trim()))
      .filter(Boolean);

    const findStageByName = (value) => {
      if (!value) return undefined;
      const direct = pipeline.stageNames.find((name) => name === value);
      if (direct) return direct;
      const insensitive = pipeline.stageNames.find(
        (name) => name.toLowerCase() === value.toLowerCase(),
      );
      return insensitive;
    };

    let stage = stageStringCandidates.map(findStageByName).find(Boolean);
    let stageForError = stageStringCandidates[0] ?? '';

    const stageIdCandidates = [body?.stageId, body?.etapaId]
      .map((candidate) => Number(candidate))
      .filter((candidate) => Number.isFinite(candidate));

    if (!stage && stageIdCandidates.length > 0 && Array.isArray(pipeline.stages)) {
      const byId = pipeline.stages.find(
        (candidate) => candidate.id != null && candidate.id === stageIdCandidates[0],
      );
      if (byId?.name) {
        stage = byId.name;
        stageForError = String(byId.name);
      }
    }

    if (!stage && stageStringCandidates.length > 0) {
      const numericCandidate = Number(stageStringCandidates[0]);
      if (Number.isFinite(numericCandidate) && Array.isArray(pipeline.stages)) {
        const byId = pipeline.stages.find(
          (candidate) => candidate.id != null && candidate.id === numericCandidate,
        );
        if (byId?.name) {
          stage = byId.name;
          stageForError = String(byId.name);
        }
      }
    }

    if (!stage && stageForError) {
      const message = `A etapa "${stageForError}" não pertence ao funil "${pipeline.name}". Selecione uma etapa válida desse funil.`;
      return badRequest(message, {
        fieldErrors: {
          stage: [message],
          etapaNome: [message],
        },
        messages: [message],
      });
    }

    if (!stage) {
      const message = 'stage inválido: envie o NOME da etapa (string)';
      return badRequest(message, {
        fieldErrors: {
          stage: ['Informe o NOME da etapa (string)'],
          etapaNome: ['Informe o NOME da etapa (string)'],
        },
        messages: [message],
      });
    }

    base.funilId = funnelId;
    base.funnelId = funnelId;
    base.etapaNome = stage;

    const addressKeys = ['address', 'addressNumber', 'addressComplement', 'neighborhood', 'zipcode', 'cidade'];
    const anyAddressField = addressKeys.some((key) => {
      const raw = key in body ? body[key] : base[key];
      return raw != null && String(raw).trim() !== '';
    });

    if (anyAddressField && (!base.estado || !base.pais)) {
      const message = 'Endereço parcial: ao informar address/addressNumber/... precisa informar também state e country';
      return badRequest(message, {
        fieldErrors: {
          state: ['Informe o estado (UF) ao preencher o endereço.'],
          country: ['Informe o país ao preencher o endereço.'],
        },
        messages: [message],
      });
    }

    const primaryPhones = toArray(body?.telefones ?? base.telefones);
    const primary = normalizePhone(body?.phone ?? primaryPhones[0], body?.ddiPhone);
    const secondary = normalizePhone(body?.phone2 ?? primaryPhones[1], body?.ddiPhone2);

    const digitsZipcode = digits(body?.zipcode ?? base.zipcode);
    const digitsCpfCnpj = digits(body?.cpfcnpj ?? body?.cpfCnpj);

    const [areasValidas, modalidadesValidas] = await Promise.all([
      (async () => {
        const value = process.env.SPOTTER_AREAS_VALIDAS;
        if (!value) return undefined;
        return value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
      })(),
      (async () => {
        const value = process.env.SPOTTER_MODALIDADES_VALIDAS;
        if (!value) return undefined;
        return value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
      })(),
    ]);

    const etapasPorFunil = Object.fromEntries(
      pipelines.map((item) => [
        String(item.id),
        Array.isArray(item.stages)
          ? item.stages
              .filter((stageItem) => stageItem?.name)
              .map((stageItem) => ({ id: stageItem.id, nome: stageItem.name }))
          : [],
      ]),
    );

    const validation = validateSpotterLead(
      {
        ...base,
        funilId: funnelId,
        funnelId,
        etapaNome: stage,
      },
      {
        areasValidas: areasValidas ?? undefined,
        modalidadesValidas: modalidadesValidas ?? undefined,
        etapasPorFunil,
      },
    );

    const messages = Array.isArray(validation?.messages) ? validation.messages : [];

    if (!validation.ok) {
      const firstMessage = messages[0] ?? 'Falha na validação dos dados para o Spotter.';
      return badRequest(firstMessage, {
        fieldErrors: validation.fieldErrors,
        messages,
      });
    }

    const leadPayload = clean({
      name: String(base.nomeLead ?? body?.name ?? '').trim(),
      industry: base.mercado || undefined,
      source: base.origem || undefined,
      subSource: body?.subSource ?? base.subOrigem || undefined,
      organizationId: body?.organizationId ?? undefined,
      sdrEmail: body?.sdrEmail ?? body?.emailPrevendedor ?? undefined,
      group: body?.group ?? undefined,
      mktLink: body?.mktLink ?? undefined,
      ddiPhone: primary.phone ? primary.ddi : undefined,
      phone: primary.phone || undefined,
      ddiPhone2: secondary.phone ? secondary.ddi : undefined,
      phone2: secondary.phone || undefined,
      website: body?.website ?? body?.site || undefined,
      leadProduct: body?.leadProduct ?? body?.produto || undefined,
      address: base.address || undefined,
      addressNumber: base.addressNumber || undefined,
      addressComplement: base.addressComplement || undefined,
      neighborhood: base.neighborhood || undefined,
      zipcode: digitsZipcode || undefined,
      city: base.cidade || undefined,
      state: base.estado || undefined,
      country: base.pais || undefined,
      cpfcnpj: digitsCpfCnpj || undefined,
      description: body?.description ?? base.observacao || undefined,
      funnelId,
      stage,
      customFields: Array.isArray(body?.customFields) ? body.customFields : undefined,
    });

    const payload = clean({
      duplicityValidation: true,
      lead: leadPayload,
    });

    console.log(
      '[Spotter][OUT]',
      JSON.stringify({
        name: leadPayload.name,
        funnelId,
        stage,
        phone: leadPayload.phone ? `***${String(leadPayload.phone).slice(-4)}` : undefined,
        cpfcnpj: leadPayload.cpfcnpj ? `***${String(leadPayload.cpfcnpj).slice(-4)}` : undefined,
        hasCustomFields: Array.isArray(leadPayload.customFields) && leadPayload.customFields.length > 0,
      }),
    );

    const url = `${SPOTTER_BASE_URL}/LeadsAdd`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        token_exact: getSpotterToken(),
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 201) {
      const data = await response.json().catch(() => ({}));
      return json(
        {
          ok: true,
          createdId: data?.value ?? null,
          messages,
        },
        201,
      );
    }

    const errorText = await response.text().catch(() => '');
    return json(
      {
        error: errorText || `Provider ${response.status}`,
        messages,
      },
      response.status,
    );
  } catch (error) {
    console.error('Erro inesperado na API do Spotter:', error);
    const reason = error?.message || 'Erro inesperado';
    return NextResponse.json({ error: reason }, { status: 500 });
  }
}
