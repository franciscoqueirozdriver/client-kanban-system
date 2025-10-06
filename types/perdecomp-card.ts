export type RiskTag = { label: string; count: number };
export type CountBlock = { label: string; count: number };

export type IdentifiedCode = {
  codigo: string;
  risco: string;
  credito_tipo: string;
  grupo: string;
  natureza: string;
  protocolo?: string;
  situacao?: string;
  situacao_detalhamento?: string;
  data_iso?: string;
};

export type CardPayload = {
  header: { nome: string; cnpj: string; ultima_consulta_iso: string };
  quantidade_total: number;
  analise_risco: { nivel: string; tags: RiskTag[] };
  quantos_sao: CountBlock[];
  por_natureza: CountBlock[];
  por_credito: CountBlock[];
  codigos_identificados: IdentifiedCode[];
  recomendacoes: string[];
  links?: { cancelamentos?: string; html?: string };
  schema_version: number;
  rendered_at_iso: string;
};

export type SnapshotMetadata = {
  clienteId: string;
  empresaId: string;
  nome: string;
  cnpj: string;
  riscoNivel: string;
  tagsRisco: RiskTag[];
  porNatureza: CountBlock[];
  porCredito: CountBlock[];
  datas: string[];
  primeiraDataISO: string;
  ultimaDataISO: string;
  renderedAtISO: string;
  cardSchemaVersion: number;
  fonte: string;
  dataConsulta: string;
  urlComprovanteHTML: string;
  payloadBytes: number;
  lastUpdatedISO: string;
  snapshotHash: string;
  factsCount: number;
  consultaId: string;
  erroUltimaConsulta: string;
  qtdTotal: number;
  qtdDcomp: number;
  qtdRest: number;
  qtdRessarc: number;
};
