import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  createPerDcomp,
  getPerDcompByFilters,
  getPerDcompWithConcorrentes,
  createConcorrente,
  deleteConcorrente,
  getConcorrentesByPerDcomp,
  exportAllPerDcomp,
  exportAllConcorrentes,
  importPerDcomp,
  importConcorrentes,
} from "../db";

const perDcompFilterSchema = z.object({
  nomeEmpresa: z.string().optional(),
  cnpj: z.string().optional(),
  dataInicio: z.date().optional(),
  dataFim: z.date().optional(),
  limit: z.number().int().positive().optional().default(50),
  offset: z.number().int().nonnegative().optional().default(0),
});

const createPerDcompSchema = z.object({
  empresaPrincipal: z.string().min(1, "Empresa principal é obrigatória"),
  cnpjPrincipal: z.string().min(1, "CNPJ é obrigatório"),
  dataInicio: z.date(),
  dataFim: z.date(),
  quantitativoTotal: z.string().optional(),
  naturezasCreditos: z.string().optional(),
  cancelamentos: z.string().optional(),
  observacoes: z.string().optional(),
});

const createConcorrenteSchema = z.object({
  perDcompId: z.number().int().positive(),
  nomeEmpresa: z.string().min(1, "Nome da empresa é obrigatório"),
  cnpj: z.string().min(1, "CNPJ é obrigatório"),
  quantitativoTotal: z.string().optional(),
  naturezasCreditos: z.string().optional(),
  cancelamentos: z.string().optional(),
});

export const perDcompRouter = router({
  list: publicProcedure
    .input(perDcompFilterSchema)
    .query(async ({ input }) => {
      const perDcomps = await getPerDcompByFilters({
        nomeEmpresa: input.nomeEmpresa,
        cnpj: input.cnpj,
        dataInicio: input.dataInicio,
        dataFim: input.dataFim,
        limit: input.limit,
        offset: input.offset,
      });

      return {
        data: perDcomps,
        limit: input.limit,
        offset: input.offset,
      };
    }),

  getWithConcorrentes: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const perDcomp = await getPerDcompWithConcorrentes(input.id);
      return perDcomp;
    }),

  create: protectedProcedure
    .input(createPerDcompSchema)
    .mutation(async ({ input }) => {
      const perDcomp = await createPerDcomp({
        empresaPrincipal: input.empresaPrincipal,
        cnpjPrincipal: input.cnpjPrincipal,
        dataInicio: input.dataInicio,
        dataFim: input.dataFim,
        quantitativoTotal: input.quantitativoTotal,
        naturezasCreditos: input.naturezasCreditos,
        cancelamentos: input.cancelamentos,
        observacoes: input.observacoes,
      });

      return perDcomp;
    }),

  export: publicProcedure.query(async () => {
    const perDcomps = await exportAllPerDcomp();
    return perDcomps;
  }),

  import: protectedProcedure
    .input(
      z.object({
        data: z.array(createPerDcompSchema),
      })
    )
    .mutation(async ({ input }) => {
      const count = await importPerDcomp(input.data);
      return { imported: count };
    }),
});

export const concorrentesRouter = router({
  listByPerDcomp: publicProcedure
    .input(z.object({ perDcompId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const concorrentes = await getConcorrentesByPerDcomp(input.perDcompId);
      return concorrentes;
    }),

  create: protectedProcedure
    .input(createConcorrenteSchema)
    .mutation(async ({ input }) => {
      const concorrente = await createConcorrente({
        perDcompId: input.perDcompId,
        nomeEmpresa: input.nomeEmpresa,
        cnpj: input.cnpj,
        quantitativoTotal: input.quantitativoTotal,
        naturezasCreditos: input.naturezasCreditos,
        cancelamentos: input.cancelamentos,
      });

      return concorrente;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await deleteConcorrente(input.id);
      return { success: true };
    }),

  export: publicProcedure.query(async () => {
    const concorrentes = await exportAllConcorrentes();
    return concorrentes;
  }),

  import: protectedProcedure
    .input(
      z.object({
        data: z.array(createConcorrenteSchema),
      })
    )
    .mutation(async ({ input }) => {
      const count = await importConcorrentes(input.data);
      return { imported: count };
    }),
});
