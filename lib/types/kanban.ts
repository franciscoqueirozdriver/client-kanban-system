// lib/types/kanban.ts
export type KanbanId = string;

export interface KanbanClient {
  id: string;
  company: string;
  segment?: string;
  size?: string;
  uf?: string;
  city?: string;
  contacts?: any[];
  opportunities?: string[];
  status: string;
  color: string;
  valor?: string;
  dataMov?: string;
  fonte?: string;
  owner?: string;
  erp?: string;
  // snake_case properties
  organizacao_segmento?: string;
  organizacao_tamanho_da_empresa?: string;
  negocio_proprietario?: string;
  negocio_etapa?: string;
  [key: string]: unknown;
}

export interface KanbanCard {
  id: KanbanId;
  client: KanbanClient;
}

export interface KanbanColumn {
  id: KanbanId;
  title: string;
  cards: KanbanCard[];
}

export type KanbanData = KanbanColumn[];
