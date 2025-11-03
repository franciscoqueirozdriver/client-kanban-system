import { z } from "zod";

export const Lead = z.object({
  leadId: z.number(),
  saleDate: z.string().optional(),
  // ...completar conforme campos usados na UI
});

export const BundleResponse = z.object({
  value: z.array(z.unknown()), // flexibiliza enquanto mapeamos tudo
});

export type BundleResponse = z.infer<typeof BundleResponse>;
