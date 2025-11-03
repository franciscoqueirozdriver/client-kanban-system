/* lib/spotter/load.ts */
import { getSpotterDataset } from "./api";

export interface SpotterMetrics {
  totalItems: number;
  totalLeads: number;
  totalSold: number;
  totalLosts: number;
  // acrescente KPIs específicos do seu dashboard aqui
}

/**
 * Carrega dataset do Spotter e aplica validações:
 * - Se totalItems = 0 em produção, lança erro (quebra o build/rota) para evitar dados silenciosamente vazios
 * - Em dev/preview, retorna fallback vazio com warn
 */
export async function loadSpotterMetrics(params?: Record<string, any>): Promise<SpotterMetrics> {
  const ds = await getSpotterDataset(params);

  const totalLeads = ds.leads.length;
  const totalSold = ds.leadsSold.length;
  const totalLosts = ds.losts.length;

  const totalItems = totalLeads + totalSold + totalLosts;

  if (totalItems === 0) {
    const mode = process.env.NODE_ENV;
    const msg = "[Spotter] Dataset vazio (0 registros em leads/sold/losts). Verifique token, filtros e conectividade.";
    if (mode === "production") {
      // Falha forte em produção para não mascarar erros de dados/conexão
      throw new Error(msg);
    } else {
      console.warn(msg);
      // Fallback “inócuo” para desenvolvimento/preview
      return {
        totalItems: 0,
        totalLeads: 0,
        totalSold: 0,
        totalLosts: 0,
      };
    }
  }

  return {
    totalItems,
    totalLeads,
    totalSold,
    totalLosts,
  };
}
