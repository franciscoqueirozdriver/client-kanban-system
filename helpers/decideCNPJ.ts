import { onlyDigits, isEmptyCNPJLike, isFilial, isMatriz, toMatrizCNPJ } from '@/utils/cnpj-matriz';

export async function decideCNPJFinal({
  currentFormCNPJ,
  enrichedCNPJ,
  ask,
}: {
  currentFormCNPJ?: string;
  enrichedCNPJ?: string;
  ask: (matriz: string, filial: string) => Promise<boolean>;
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
