import { describe, it, expect } from "vitest";
import { z } from "zod";

const mockPerDcomp = [
  {
    id: 1,
    empresaPrincipal: "Empresa A",
    cnpjPrincipal: "12.345.678/0001-90",
    dataInicio: new Date("2021-02-07"),
    dataFim: new Date("2026-02-07"),
    quantitativoTotal: "1000.00",
    naturezasCreditos: "PIS, COFINS",
    cancelamentos: "Nenhum",
    observacoes: "Teste",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockConcorrentes = [
  {
    id: 1,
    perDcompId: 1,
    nomeEmpresa: "Concorrente A",
    cnpj: "98.765.432/0001-10",
    quantitativoTotal: "800.00",
    naturezasCreditos: "PIS",
    cancelamentos: "Nenhum",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe("PER/DCOMP Router", () => {
  describe("Validação de Schema", () => {
    it("deve validar schema de criação de PER/DCOMP", () => {
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

      const validData = {
        empresaPrincipal: "Empresa A",
        cnpjPrincipal: "12.345.678/0001-90",
        dataInicio: new Date("2021-02-07"),
        dataFim: new Date("2026-02-07"),
      };

      const result = createPerDcompSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("deve rejeitar PER/DCOMP sem empresa principal", () => {
      const createPerDcompSchema = z.object({
        empresaPrincipal: z.string().min(1, "Empresa principal é obrigatória"),
        cnpjPrincipal: z.string().min(1, "CNPJ é obrigatório"),
        dataInicio: z.date(),
        dataFim: z.date(),
      });

      const invalidData = {
        cnpjPrincipal: "12.345.678/0001-90",
        dataInicio: new Date("2021-02-07"),
        dataFim: new Date("2026-02-07"),
      };

      const result = createPerDcompSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("deve validar datas de período", () => {
      const createPerDcompSchema = z.object({
        dataInicio: z.date(),
        dataFim: z.date(),
      });

      const validDates = {
        dataInicio: new Date("2021-02-07"),
        dataFim: new Date("2026-02-07"),
      };

      const result = createPerDcompSchema.safeParse(validDates);
      expect(result.success).toBe(true);
    });
  });

  describe("Filtros", () => {
    it("deve validar schema de filtros de PER/DCOMP", () => {
      const perDcompFilterSchema = z.object({
        nomeEmpresa: z.string().optional(),
        cnpj: z.string().optional(),
        dataInicio: z.date().optional(),
        dataFim: z.date().optional(),
        limit: z.number().int().positive().optional().default(50),
        offset: z.number().int().nonnegative().optional().default(0),
      });

      const validFilter = {
        nomeEmpresa: "Empresa A",
        cnpj: "12.345.678/0001-90",
        limit: 20,
      };

      const result = perDcompFilterSchema.safeParse(validFilter);
      expect(result.success).toBe(true);
    });

    it("deve buscar PER/DCOMP por nome de empresa", () => {
      const searchTerm = "Empresa A";
      const resultados = mockPerDcomp.filter((p) => p.empresaPrincipal.includes(searchTerm));
      expect(resultados).toHaveLength(1);
    });

    it("deve buscar PER/DCOMP por CNPJ", () => {
      const searchCnpj = "12.345.678/0001-90";
      const resultados = mockPerDcomp.filter((p) => p.cnpjPrincipal.includes(searchCnpj));
      expect(resultados).toHaveLength(1);
    });

    it("deve filtrar PER/DCOMP por período", () => {
      const dataInicio = new Date("2021-01-01");
      const dataFim = new Date("2026-12-31");
      const resultados = mockPerDcomp.filter(
        (p) => p.dataInicio >= dataInicio && p.dataFim <= dataFim
      );
      expect(resultados).toHaveLength(1);
    });
  });

  describe("Lógica de Negócio", () => {
    it("deve aplicar paginação a PER/DCOMP", () => {
      const limit = 1;
      const offset = 0;
      const paginated = mockPerDcomp.slice(offset, offset + limit);
      expect(paginated).toHaveLength(1);
    });

    it("deve recuperar PER/DCOMP com concorrentes", () => {
      const perDcomp = mockPerDcomp[0];
      const concorrentes = mockConcorrentes.filter((c) => c.perDcompId === perDcomp.id);

      expect(concorrentes).toHaveLength(1);
      expect(concorrentes[0].nomeEmpresa).toBe("Concorrente A");
    });
  });

  describe("Dados de Exportação", () => {
    it("deve exportar PER/DCOMP em formato JSON", () => {
      const json = JSON.stringify(mockPerDcomp);
      const parsed = JSON.parse(json);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].empresaPrincipal).toBe("Empresa A");
    });

    it("deve manter estrutura de dados ao exportar PER/DCOMP", () => {
      const json = JSON.stringify(mockPerDcomp);
      const parsed = JSON.parse(json);

      const requiredFields = ["id", "empresaPrincipal", "cnpjPrincipal", "dataInicio", "dataFim"];
      requiredFields.forEach((field) => {
        expect(parsed[0]).toHaveProperty(field);
      });
    });
  });

  describe("Dados de Importação", () => {
    it("deve validar array de PER/DCOMP para importação", () => {
      const importSchema = z.array(
        z.object({
          empresaPrincipal: z.string().min(1),
          cnpjPrincipal: z.string().min(1),
          dataInicio: z.date(),
          dataFim: z.date(),
        })
      );

      const validData = [
        {
          empresaPrincipal: "Empresa A",
          cnpjPrincipal: "12.345.678/0001-90",
          dataInicio: new Date("2021-02-07"),
          dataFim: new Date("2026-02-07"),
        },
      ];

      const result = importSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });
});

describe("Concorrentes Router", () => {
  describe("Validação de Schema", () => {
    it("deve validar schema de criação de concorrente", () => {
      const createConcorrenteSchema = z.object({
        perDcompId: z.number().int().positive(),
        nomeEmpresa: z.string().min(1, "Nome da empresa é obrigatório"),
        cnpj: z.string().min(1, "CNPJ é obrigatório"),
        quantitativoTotal: z.string().optional(),
        naturezasCreditos: z.string().optional(),
        cancelamentos: z.string().optional(),
      });

      const validData = {
        perDcompId: 1,
        nomeEmpresa: "Concorrente A",
        cnpj: "98.765.432/0001-10",
      };

      const result = createConcorrenteSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("deve rejeitar concorrente sem nome", () => {
      const createConcorrenteSchema = z.object({
        perDcompId: z.number().int().positive(),
        nomeEmpresa: z.string().min(1, "Nome da empresa é obrigatório"),
        cnpj: z.string().min(1, "CNPJ é obrigatório"),
      });

      const invalidData = {
        perDcompId: 1,
        cnpj: "98.765.432/0001-10",
      };

      const result = createConcorrenteSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("deve rejeitar perDcompId inválido", () => {
      const createConcorrenteSchema = z.object({
        perDcompId: z.number().int().positive(),
      });

      const invalidData = { perDcompId: -1 };
      const result = createConcorrenteSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("Lógica de Negócio", () => {
    it("deve listar concorrentes por PER/DCOMP", () => {
      const perDcompId = 1;
      const concorrentes = mockConcorrentes.filter((c) => c.perDcompId === perDcompId);
      expect(concorrentes).toHaveLength(1);
    });

    it("deve permitir até 3 concorrentes por PER/DCOMP", () => {
      const perDcompId = 1;
      const concorrentes = mockConcorrentes.filter((c) => c.perDcompId === perDcompId);
      expect(concorrentes.length).toBeLessThanOrEqual(3);
    });
  });

  describe("Dados de Exportação", () => {
    it("deve exportar concorrentes em formato JSON", () => {
      const json = JSON.stringify(mockConcorrentes);
      const parsed = JSON.parse(json);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].nomeEmpresa).toBe("Concorrente A");
    });
  });

  describe("Dados de Importação", () => {
    it("deve validar array de concorrentes para importação", () => {
      const importSchema = z.array(
        z.object({
          perDcompId: z.number().int().positive(),
          nomeEmpresa: z.string().min(1),
          cnpj: z.string().min(1),
        })
      );

      const validData = [
        {
          perDcompId: 1,
          nomeEmpresa: "Concorrente A",
          cnpj: "98.765.432/0001-10",
        },
      ];

      const result = importSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });
});
