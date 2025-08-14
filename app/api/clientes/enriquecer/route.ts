import { NextResponse } from 'next/server';
import { enrichCompanyData } from '@/lib/perplexity-client';

export async function POST(request: Request) {
  let companyData;
  try {
    companyData = await request.json();
  } catch (error) {
    return NextResponse.json({ ok: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  if (!companyData || !companyData.nome) {
      return NextResponse.json({ ok: false, message: 'Company data must include a name ("nome").' }, { status: 400 });
  }

  try {
    const enrichedData = await enrichCompanyData(companyData);
    return NextResponse.json({ ok: true, data: enrichedData });
  } catch (error) {
    console.error('Error during data enrichment:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during enrichment.';
    return NextResponse.json({ ok: false, message: errorMessage }, { status: 500 });
  }
}
