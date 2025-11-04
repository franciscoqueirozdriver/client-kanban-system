"use client";

import { redirect } from "next/navigation";

export default function PGFNPage() {
  const disabled = process.env.NEXT_PUBLIC_DISABLE_PGFN === "true";

  if (disabled) {
    redirect("/");
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Painel = require("@/features/pgfn/PainelPGFNProspecao").default;

  return <Painel />;
}
