import { eq, and, gte, lte, like, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, teses, InsertTese, Tese, perDcomp, InsertPerDcomp, PerDcomp, concorrentes, InsertConcorrente, Concorrente } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============= TESES QUERIES =============

export async function createTese(data: InsertTese): Promise<Tese> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(teses).values(data);
  const id = result[0].insertId as number;
  
  const created = await db.select().from(teses).where(eq(teses.id, id)).limit(1);
  return created[0];
}

export async function updateTese(id: number, data: Partial<InsertTese>): Promise<Tese | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(teses).set(data).where(eq(teses.id, id));
  
  const updated = await db.select().from(teses).where(eq(teses.id, id)).limit(1);
  return updated.length > 0 ? updated[0] : null;
}

export async function getTesesByFilters(filters: {
  search?: string;
  status?: "ativa" | "inativa";
  risco?: "remoto" | "baixo" | "medio" | "alto";
  limit?: number;
  offset?: number;
}): Promise<Tese[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [];

  if (filters.search) {
    conditions.push(
      like(teses.tema, `%${filters.search}%`)
    );
  }

  if (filters.status) {
    conditions.push(eq(teses.status, filters.status));
  }

  if (filters.risco) {
    conditions.push(eq(teses.grauRisco, filters.risco));
  }

  let query: any = db.select().from(teses);

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  query = query.orderBy(desc(teses.createdAt));

  if (filters.limit) {
    query = query.limit(filters.limit);
  }

  if (filters.offset) {
    query = query.offset(filters.offset);
  }

  return query;
}

export async function getTesesCount(filters?: {
  status?: "ativa" | "inativa";
  risco?: "remoto" | "baixo" | "medio" | "alto";
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [];

  if (filters?.status) {
    conditions.push(eq(teses.status, filters.status));
  }

  if (filters?.risco) {
    conditions.push(eq(teses.grauRisco, filters.risco));
  }

  let query: any = db.select().from(teses);

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const result = await query;
  return result.length;
}

export async function getTesesByStatus(status: "ativa" | "inativa"): Promise<Tese[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(teses).where(eq(teses.status, status));
}

export async function getTesesByRisco(risco: "remoto" | "baixo" | "medio" | "alto"): Promise<Tese[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(teses).where(eq(teses.grauRisco, risco));
}

// ============= PER/DCOMP QUERIES =============

export async function createPerDcomp(data: InsertPerDcomp): Promise<PerDcomp> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(perDcomp).values(data);
  const id = result[0].insertId as number;
  
  const created = await db.select().from(perDcomp).where(eq(perDcomp.id, id)).limit(1);
  return created[0];
}

export async function getPerDcompByFilters(filters: {
  nomeEmpresa?: string;
  cnpj?: string;
  dataInicio?: Date;
  dataFim?: Date;
  limit?: number;
  offset?: number;
}): Promise<PerDcomp[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [];

  if (filters.nomeEmpresa) {
    conditions.push(like(perDcomp.empresaPrincipal, `%${filters.nomeEmpresa}%`));
  }

  if (filters.cnpj) {
    conditions.push(like(perDcomp.cnpjPrincipal, `%${filters.cnpj}%`));
  }

  if (filters.dataInicio) {
    conditions.push(gte(perDcomp.dataInicio, filters.dataInicio));
  }

  if (filters.dataFim) {
    conditions.push(lte(perDcomp.dataFim, filters.dataFim));
  }

  let query: any = db.select().from(perDcomp);

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  query = query.orderBy(desc(perDcomp.createdAt));

  if (filters.limit) {
    query = query.limit(filters.limit);
  }

  if (filters.offset) {
    query = query.offset(filters.offset);
  }

  return query;
}

export async function getPerDcompWithConcorrentes(perDcompId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const per = await db.select().from(perDcomp).where(eq(perDcomp.id, perDcompId)).limit(1);
  if (!per.length) return null;

  const conc = await db.select().from(concorrentes).where(eq(concorrentes.perDcompId, perDcompId));

  return {
    ...per[0],
    concorrentes: conc,
  };
}

// ============= CONCORRENTES QUERIES =============

export async function createConcorrente(data: InsertConcorrente): Promise<Concorrente> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(concorrentes).values(data);
  const id = result[0].insertId as number;
  
  const created = await db.select().from(concorrentes).where(eq(concorrentes.id, id)).limit(1);
  return created[0];
}

export async function deleteConcorrente(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(concorrentes).where(eq(concorrentes.id, id));
}

export async function getConcorrentesByPerDcomp(perDcompId: number): Promise<Concorrente[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(concorrentes).where(eq(concorrentes.perDcompId, perDcompId));
}

// ============= EXPORT/IMPORT HELPERS =============

export async function exportAllTeses(): Promise<Tese[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(teses);
}

export async function exportAllPerDcomp(): Promise<PerDcomp[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(perDcomp);
}

export async function exportAllConcorrentes(): Promise<Concorrente[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(concorrentes);
}

export async function importTeses(data: InsertTese[]): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(teses).values(data);
  return result[0].affectedRows || 0;
}

export async function importPerDcomp(data: InsertPerDcomp[]): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(perDcomp).values(data);
  return result[0].affectedRows || 0;
}

export async function importConcorrentes(data: InsertConcorrente[]): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(concorrentes).values(data);
  return result[0].affectedRows || 0;
}
