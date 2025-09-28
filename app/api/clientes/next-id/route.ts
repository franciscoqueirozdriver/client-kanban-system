import { NextResponse } from 'next/server';
import { getNextClienteId } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic'; // Prevent caching of this route

/**
 * Handles GET requests to generate the next available Cliente_ID.
 * This endpoint acts as a centralized, single source of truth for new IDs.
 */
export async function GET() {
  try {
    const nextId = await getNextClienteId();
    return NextResponse.json({ nextId });
  } catch (error: any) {
    console.error('Failed to generate next Cliente_ID:', error);
    return NextResponse.json(
      { error: 'Failed to generate next ID', details: error.message },
      { status: 500 }
    );
  }
}