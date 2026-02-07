import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  createTese,
  updateTese,
  getTesesByFilters,
  getTesesCount,
  getTesesByStatus,
  getTesesByRisco,
  exportAllTeses,
  importTeses,
} from "../db";

const tesesFilterSchema = z.object({
  search: z.string().optional(),
  status: z.enum(["ativa", "inativa"]).optional(),
  risco: z.enum(["remoto", "baixo", "medio", "alto"]).optional(),
  limit: z.number().int().positive().optional().default(50),
  offset: z.number().int().nonnegative().optional().default(0),
});

const createTesesSchema = z.object({
  tema: z.string().min(1, "Tema é obrigatório"),
  tipo: z.string().min(1, "Tipo é obrigatório"),
  tributo: z.string().min(1, "Tributo é obrigatório"),
  publicoAlvo: z.string().optional(),
  grauRisco: z.enum(["remoto", "baixo", "medio", "alto"]).default("baixo"),
  baseLegal: z.string().optional(),
  contextoDoireito: z.string().optional(),
  tributoDoCredito: z.string().optional(),
  documentacaoNecessaria: z.string().optional(),
  informacoesAnalise: z.string().optional(),
  formaUtilizacao: z.string().optional(),
  status: z.enum(["ativa", "inativa"]).default("inativa"),
  ativa: z.boolean().default(false),
});

const updateTesesSchema = createTesesSchema.partial();

export const tesasRouter = router({
  list: publicProcedure
    .input(tesesFilterSchema)
    .query(async ({ input }) => {
      const teses = await getTesesByFilters({
        search: input.search,
        status: input.status,
        risco: input.risco,
        limit: input.limit,
        offset: input.offset,
      });

      const total = await getTesesCount({
        status: input.status,
        risco: input.risco,
      });

      return {
        data: teses,
        total,
        limit: input.limit,
        offset: input.offset,
      };
    }),

  stats: publicProcedure.query(async () => {
    const total = await getTesesCount();
    const ativas = await getTesesCount({ status: "ativa" });
    const inativas = await getTesesCount({ status: "inativa" });
    const riscoRemoto = await getTesesCount({ risco: "remoto" });

    return {
      total,
      ativas,
      inativas,
      riscoRemoto,
    };
  }),

  create: protectedProcedure
    .input(createTesesSchema)
    .mutation(async ({ input }) => {
      const tese = await createTese({
        tema: input.tema,
        tipo: input.tipo,
        tributo: input.tributo,
        publicoAlvo: input.publicoAlvo,
        grauRisco: input.grauRisco,
        baseLegal: input.baseLegal,
        contextoDoireito: input.contextoDoireito,
        tributoDoCredito: input.tributoDoCredito,
        documentacaoNecessaria: input.documentacaoNecessaria,
        informacoesAnalise: input.informacoesAnalise,
        formaUtilizacao: input.formaUtilizacao,
        status: input.status,
        ativa: input.ativa,
      });

      return tese;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        data: updateTesesSchema,
      })
    )
    .mutation(async ({ input }) => {
      const tese = await updateTese(input.id, input.data);
      return tese;
    }),

  toggleStatus: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      // Get current tese to toggle status
      const teses = await getTesesByFilters({ limit: 1, offset: 0 });
      const tese = teses.find((t) => t.id === input.id);

      if (!tese) {
        throw new Error("Tese não encontrada");
      }

      const newStatus = tese.status === "ativa" ? "inativa" : "ativa";
      const newAtiva = !tese.ativa;

      const updated = await updateTese(input.id, {
        status: newStatus,
        ativa: newAtiva,
      });

      return updated;
    }),

  export: publicProcedure.query(async () => {
    const teses = await exportAllTeses();
    return teses;
  }),

  import: protectedProcedure
    .input(
      z.object({
        data: z.array(createTesesSchema),
      })
    )
    .mutation(async ({ input }) => {
      const count = await importTeses(input.data);
      return { imported: count };
    }),
});
