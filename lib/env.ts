// lib/env.ts
import { z } from 'zod';

export const EnvSchema = z.object({
  SPREADSHEET_ID: z.string().min(10),
  SHEET_TAB_KANBAN: z.string().min(1),
  SHEET_RANGE_KANBAN: z.string().min(1),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_BASE_URL: z.string().url().optional(),
});

export const env = EnvSchema.parse(process.env);
