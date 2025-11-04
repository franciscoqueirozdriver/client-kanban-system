import { NextResponse } from 'next/server';
import {
  getNextClienteId,
  findByCnpj,
  findByName,
  appendToSheets,
  updateInSheets,
} from '../../../../lib/googleSheets';
import { normalizeCNPJ, isValidCNPJ } from '@/src/utils/cnpj';

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const { cliente_id, empresa, contato, comercial } = payload;

    if (!empresa?.nome_da_empresa) {
      return NextResponse.json({ message: 'O "Nome da Empresa" é obrigatório.' }, { status: 400 });
    }

    const normalizedCnpj = normalizeCNPJ(empresa.cnpj_empresa);
    if (empresa.cnpj_empresa && !isValidCNPJ(normalizedCnpj)) {
      return NextResponse.json({ message: 'O CNPJ informado é inválido.' }, { status: 400 });
    }

    if (cliente_id) {
      await updateInSheets(cliente_id, payload);
      const savedCompany = {
          cliente_id,
          nome_da_empresa: empresa.nome_da_empresa,
          cnpj_empresa: normalizedCnpj,
      };
      return NextResponse.json({ ok: true, company: savedCompany }, { status: 200 });
    }

    if (normalizedCnpj) {
      const existingByCnpj = await findByCnpj(normalizedCnpj);
      if (existingByCnpj) {
        return NextResponse.json(
          { message: `Empresa já cadastrada com este CNPJ.`, company: existingByCnpj },
          { status: 409 }
        );
      }
    }

    const existingByName = await findByName(empresa.nome_da_empresa);
    if (existingByName && !normalizeCNPJ(existingByName['cnpj_empresa'])) {
       return NextResponse.json(
        {
            message: 'Encontramos uma empresa com este nome mas sem CNPJ. Deseja enriquecer o cadastro existente?',
            mode: 'enrich-existing',
            company: existingByName
        },
        { status: 200 }
      );
    }

    const newClienteId = await getNextClienteId();
    const finalPayload = { ...payload, cliente_id: newClienteId };

    await appendToSheets('sheet1', finalPayload);

    const savedCompany = {
        cliente_id: newClienteId,
        nome_da_empresa: empresa.nome_da_empresa,
        cnpj_empresa: normalizedCnpj,
    };
    return NextResponse.json({ ok: true, company: savedCompany }, { status: 201 });

  } catch (error: any) {
    console.error('[API /empresas/cadastrar]', error);
    return NextResponse.json({ message: `Erro interno no servidor: ${error.message}` }, { status: 500 });
  }
}
