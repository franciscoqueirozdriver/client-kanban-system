const MOTIVO_RECEPCIONADO = 'Recepcionado';
const MOTIVO_DEFERIDO = 'Deferido';
const MOTIVO_INDEFERIDO = 'Indeferido';
const MOTIVO_CANCELADO = 'Cancelado';
const MOTIVO_CANCELAMENTO_NEGADO = 'Cancelamento negado';
const MOTIVO_HOMOLOGADO = 'Homologado';
const MOTIVO_OUTRO = 'Outro';

const SITUACAO_EM_ANALISE = 'Em análise';
const DETALHE_RECEPCIONADO = 'Recepcionado em procedimento de análise';
const DETALHE_DIREITO_RECONHECIDO =
  'Análise concluída com direito creditório reconhecido';

export function normalizaMotivo(
  situacao?: string,
  detalhe?: string
):
  | typeof MOTIVO_RECEPCIONADO
  | typeof MOTIVO_DEFERIDO
  | typeof MOTIVO_INDEFERIDO
  | typeof MOTIVO_CANCELADO
  | typeof MOTIVO_CANCELAMENTO_NEGADO
  | typeof MOTIVO_HOMOLOGADO
  | typeof MOTIVO_OUTRO {
  const situacaoTrimmed = situacao?.trim();
  const detalheTrimmed = detalhe?.trim();
  const detalheLower = detalheTrimmed?.toLowerCase();

  if (
    situacaoTrimmed === SITUACAO_EM_ANALISE &&
    detalheTrimmed === DETALHE_RECEPCIONADO
  ) {
    return MOTIVO_RECEPCIONADO;
  }

  if (detalheTrimmed === DETALHE_DIREITO_RECONHECIDO) {
    return MOTIVO_DEFERIDO;
  }

  if (detalheLower?.includes('análise concluída') && detalheLower.includes('indeferi')) {
    return MOTIVO_INDEFERIDO;
  }

  if (detalheTrimmed === 'Pedido de cancelamento deferido') {
    return MOTIVO_CANCELADO;
  }

  if (detalheTrimmed === 'Pedido de cancelamento indeferido') {
    return MOTIVO_CANCELAMENTO_NEGADO;
  }

  if (detalheTrimmed === 'Homologado') {
    return MOTIVO_HOMOLOGADO;
  }

  return MOTIVO_OUTRO;
}
