import { NextResponse } from "next/server";
import { spotterGet } from "@/lib/exactSpotter";

export async function GET() {
  try {
    const data = await spotterGet("Funnels");
    return NextResponse.json({ funnels: data?.value ?? [] }, { status: 200 });
  } catch (err: any) {
    console.error("Spotter /Funnels failed:", err?.message || err);
    return NextResponse.json(
      { error: "Erro ao listar funis do Spotter" },
      { status: 502 }
    );
  }
}
