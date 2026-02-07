import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Teses Tributárias - Gerenciamento de teses de habilitação de créditos tributários
 */
export const teses = mysqlTable("teses", {
  id: int("id").autoincrement().primaryKey(),
  tema: varchar("tema", { length: 255 }).notNull(),
  tipo: varchar("tipo", { length: 100 }).notNull(),
  tributo: varchar("tributo", { length: 100 }).notNull(),
  publicoAlvo: varchar("publicoAlvo", { length: 255 }),
  grauRisco: mysqlEnum("grauRisco", ["remoto", "baixo", "medio", "alto"]).default("baixo").notNull(),
  baseLegal: text("baseLegal"),
  contextoDoireito: text("contextoDoireito"),
  tributoDoCredito: varchar("tributoDoCredito", { length: 100 }),
  documentacaoNecessaria: text("documentacaoNecessaria"),
  informacoesAnalise: text("informacoesAnalise"),
  formaUtilizacao: text("formaUtilizacao"),
  status: mysqlEnum("status", ["ativa", "inativa"]).default("inativa").notNull(),
  ativa: boolean("ativa").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Tese = typeof teses.$inferSelect;
export type InsertTese = typeof teses.$inferInsert;

/**
 * PER/DCOMP - Consultas de Períodos de Apuração
 */
export const perDcomp = mysqlTable("per_dcomp", {
  id: int("id").autoincrement().primaryKey(),
  empresaPrincipal: varchar("empresaPrincipal", { length: 255 }).notNull(),
  cnpjPrincipal: varchar("cnpjPrincipal", { length: 18 }).notNull(),
  dataInicio: timestamp("dataInicio").notNull(),
  dataFim: timestamp("dataFim").notNull(),
  quantitativoTotal: decimal("quantitativoTotal", { precision: 15, scale: 2 }),
  naturezasCreditos: text("naturezasCreditos"), // JSON array
  cancelamentos: text("cancelamentos"), // JSON array
  observacoes: text("observacoes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PerDcomp = typeof perDcomp.$inferSelect;
export type InsertPerDcomp = typeof perDcomp.$inferInsert;

/**
 * Concorrentes - Empresas para comparação em PER/DCOMP
 */
export const concorrentes = mysqlTable("concorrentes", {
  id: int("id").autoincrement().primaryKey(),
  perDcompId: int("perDcompId").notNull(),
  nomeEmpresa: varchar("nomeEmpresa", { length: 255 }).notNull(),
  cnpj: varchar("cnpj", { length: 18 }).notNull(),
  quantitativoTotal: decimal("quantitativoTotal", { precision: 15, scale: 2 }),
  naturezasCreditos: text("naturezasCreditos"), // JSON array
  cancelamentos: text("cancelamentos"), // JSON array
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Concorrente = typeof concorrentes.$inferSelect;
export type InsertConcorrente = typeof concorrentes.$inferInsert;
