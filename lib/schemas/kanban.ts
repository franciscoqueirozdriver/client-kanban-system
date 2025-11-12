// lib/schemas/kanban.ts
import { z } from 'zod';

export const KanbanClientZ = z.object({
  id: z.string(),
  company: z.string(),
  segment: z.string().optional(),
  size: z.string().optional(),
  uf: z.string().optional(),
  city: z.string().optional(),
  contacts: z.array(z.any()).optional(),
  opportunities: z.array(z.string()).optional(),
  status: z.string(),
  color: z.string(),
  valor: z.string().optional(),
  dataMov: z.string().optional(),
  fonte: z.string().optional(),
  owner: z.string().optional(),
  erp: z.string().optional(),
  // snake_case properties
  organizacao_segmento: z.string().optional(),
  organizacao_tamanho_da_empresa: z.string().optional(),
  negocio_proprietario: z.string().optional(),
  negocio_etapa: z.string().optional(),
});

export const KanbanCardZ = z.object({
  id: z.string(),
  client: KanbanClientZ,
});

export const KanbanColumnZ = z.object({
  id: z.string(),
  title: z.string(),
  cards: z.array(KanbanCardZ),
});

export const KanbanDataZ = z.array(KanbanColumnZ);
