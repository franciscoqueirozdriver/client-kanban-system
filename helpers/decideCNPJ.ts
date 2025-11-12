import { onlyDigits, isEmptyCNPJLike, isFilial, isMatriz, toMatrizCNPJ } from '@/utils/cnpj-matriz';

export type MatrizFilialAskFn = (matriz: string, filial: string) => Promise<boolean>;

export async function decideCNPJFinal({
  currentFormCNPJ,
  enrichedCNPJ,
  ask,
}: {
  currentFormCNPJ?: string;
  enrichedCNPJ?: string;
  ask: MatrizFilialAskFn;
}): Promise<string> {
  const current = onlyDigits(currentFormCNPJ);
  const enriched = onlyDigits(enrichedCNPJ);

  let candidate = isEmptyCNPJLike(current) && enriched ? enriched : current;

  if (isFilial(candidate)) {
    const matriz = toMatrizCNPJ(candidate);
    const useMatriz = await ask(matriz, candidate);
    candidate = useMatriz ? matriz : candidate;
  }
  if (isMatriz(candidate)) return candidate;

  return candidate;
}

type DecideBeforeQueryOpts = {
  clienteId: string;
  cnpjAtual: string;
  ask: MatrizFilialAskFn;
};

export async function decideCNPJFinalBeforeQuery({
  clienteId: _clienteId,
  cnpjAtual,
  ask,
}: DecideBeforeQueryOpts): Promise<string> {
  const digits = onlyDigits(cnpjAtual || '');
  if (!digits || !isFilial(digits)) return digits;

  const matriz = toMatrizCNPJ(digits);
  const usarMatriz = await ask(matriz, digits);
  return usarMatriz ? matriz : digits;
}
