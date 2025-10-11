import { NextResponse } from 'next/server';
import { NextResponse } from 'next/server';
import { spotterGet, spotterPost } from '@/lib/exactSpotter.ts';
import { getSpotterAreasValidas, getSpotterModalidadesValidas } from '@/lib/spotter-env.ts';
const { validateSpotterLead } = require('../../../../validators/spotterLead');

const splitPhone = (raw) => {
  const digits = String(raw ?? '')
    .replace(/\D+/g, '')
    .trim();
  if (!digits) return { ddi: undefined, phone: undefined };

  let ddi = '55';
  let rest = digits;

  if (digits.startsWith('55') && digits.length > 2) {
    rest = digits.slice(2);
  } else if (digits.length > 11) {
    ddi = digits.slice(0, digits.length - 10) || '55';
    rest = digits.slice(-10);
  }

  rest = rest.replace(/^0+/, '');
  if (!rest) {
    return { ddi: undefined, phone: undefined };
  }

  return { ddi, phone: rest };
};

const toArray = (value) => {
  if (!value) return [];
  return String(value)
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean);
};

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
    };

    const stageIdFromBody = body?.stageId ?? body?.etapaId ?? null;

    const [areasValidas, modalidadesValidas] = await Promise.all([
      getSpotterAreasValidas(),
      getSpotterModalidadesValidas(),
    ]);

    const serverMessages = [];
    let etapasPorFunil;

    if (base.funilId && base.etapaNome) {
      try {
        const stagesResponse = await spotterGet(`Funnels/${base.funilId}/Stages`);
        const rawStages = Array.isArray(stagesResponse?.value)
          ? stagesResponse.value
          : Array.isArray(stagesResponse)
          ? stagesResponse
          : [];

        const mappedStages = rawStages
          .map((stage) => ({
            id: stage.id ?? stage.ID ?? stage.value ?? stage.name,
            nome: stage.value ?? stage.name ?? stage.nome ?? '',
          }))
          .map((stage) => ({
            id: stage.id != null ? String(stage.id) : null,
            nome: stage.nome,
          }))
          .filter((stage) => stage.nome);

        if (stageIdFromBody) {
          const normalizedStageId = String(stageIdFromBody);
          const matchById = mappedStages.find((stage) => stage.id === normalizedStageId);
          if (!matchById) {
            serverMessages.push('A etapa selecionada não pertence ao funil informado.');
          } else if (!base.etapaNome) {
            base.etapaNome = matchById.nome;
          }
        }

        if (mappedStages.length > 0) {
          etapasPorFunil = { [String(base.funilId)]: mappedStages };
        } else {
          serverMessages.push('Não foi possível validar as etapas deste funil com os dados retornados pelo Spotter.');
        }
      } catch (err) {
        console.error('Falha ao carregar etapas do funil no Spotter:', err);
        serverMessages.push('Não foi possível consultar as etapas do funil no Spotter para validar a etapa informada.');
      }
    }

    const validation = validateSpotterLead(base, {
      areasValidas: areasValidas ?? undefined,
      modalidadesValidas: modalidadesValidas ?? undefined,
      etapasPorFunil,
    });

    const messages = [...validation.messages, ...serverMessages];

    if (!validation.ok) {
      return NextResponse.json(
        {
          error: 'Campos inválidos',
          fieldErrors: validation.fieldErrors,
          messages,
        },
        { status: 400 },
      );
    }

    const phoneList = toArray(base.telefones);
    const firstPhone = phoneList[0] ? splitPhone(phoneList[0]) : { ddi: undefined, phone: undefined };
    const secondPhone = phoneList[1] ? splitPhone(phoneList[1]) : { ddi: undefined, phone: undefined };

    const spotterPayload = {
      name: base.nomeLead,
      industry: base.mercado,
      source: base.origem,
      funnelId: base.funilId ?? null,
      stage: base.etapaNome ?? undefined,
      stageId: stageIdFromBody != null ? String(stageIdFromBody) : undefined,
      ddiPhone: firstPhone.phone ? firstPhone.ddi ?? '55' : undefined,
      phone: firstPhone.phone ?? undefined,
      ddiPhone2: secondPhone.phone ? secondPhone.ddi ?? '55' : undefined,
      phone2: secondPhone.phone ?? undefined,
      subSource: body?.subSource ?? body?.subOrigem ?? undefined,
      organizationId: body?.organizationId ?? undefined,
      sdrEmail: body?.sdrEmail ?? body?.emailPrevendedor ?? undefined,
      group: body?.group ?? undefined,
      mktLink: body?.mktLink ?? undefined,
      website: body?.website ?? body?.site ?? undefined,
      leadProduct: body?.leadProduct ?? body?.produto ?? undefined,
      address: base.address || undefined,
      addressNumber: base.addressNumber || undefined,
      addressComplement: base.addressComplement || undefined,
      neighborhood: base.neighborhood || undefined,
      zipcode: base.zipcode || undefined,
      city: base.cidade || undefined,
      state: base.estado || undefined,
      country: base.pais || undefined,
      cpfcnpj: body?.cpfcnpj ?? body?.cpfCnpj ?? undefined,
      description: body?.description ?? body?.observacao ?? undefined,
      duplicityValidation: body?.duplicityValidation ?? false,
    };

    if (Array.isArray(body?.customFields) && body.customFields.length > 0) {
      spotterPayload.customFields = body.customFields;
    }

    const cleanedPayload = Object.fromEntries(
      Object.entries(spotterPayload).filter(([, value]) => value !== undefined),
    );

    let spotterResponse;
    try {
      spotterResponse = await spotterPost('LeadsAdd', cleanedPayload);
    } catch (error) {
      console.error('Erro ao enviar lead ao Spotter:', error);
      return NextResponse.json(
        {
          error: 'Falha ao enviar ao Spotter',
          details: error?.message || String(error),
          messages,
        },
        { status: 502 },
      );
    }

    if (spotterResponse?.success === false) {
      return NextResponse.json(
        {
          error: spotterResponse?.message || 'Falha ao enviar ao Spotter',
          fieldErrors: spotterResponse?.fieldErrors,
          messages,
          raw: spotterResponse,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        data: spotterResponse,
        messages,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Erro inesperado na API do Spotter:', error);
    return NextResponse.json(
      {
        error: 'Erro no servidor',
        details: error?.message || String(error),
      },
      { status: 500 },
    );
  }
}
