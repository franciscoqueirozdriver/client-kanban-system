# Perdecomp Comparativo Module Guide

This document serves as a guide for an AI agent to understand, maintain, or recreate the "PER/DCOMP Comparativo" module in the Client Kanban System.

## 1. Overview
The **PER/DCOMP Comparativo** module allows users to consult, visualize, and compare federal tax compensation/restitution data (PER/DCOMP) for a main client and up to 3 competitors.

**Key Features:**
- **Consultation:** Fetches historical PER/DCOMP data.
- **Persistence:** Saves snapshots of data to Google Sheets to avoid re-fetching from expensive external APIs (Infosimples).
- **Comparison:** Side-by-side view of metrics (Quantity, Total Value, Breakdown by Type/Nature).
- **Verification:** Checks if a company has been consulted recently to prevent redundant API calls.

## 2. Architecture

The module follows a **Next.js App Router** structure with a clear separation between the Frontend (React Client Components), the Backend (API Routes), and the Data Layer (Google Sheets).

### 2.1. Frontend
**Path:** `app/consultas/perdecomp-comparativo/`

- **`ClientPerdecompComparativo.tsx`**: The main orchestrator.
  - Manages state for `client` (CompanySelection) and `competitors` (Array<CompanySelection>).
  - Handles the user flow: Select Company -> Verify Date (`/verificar`) -> Consult (`/snapshot`).
  - Displays results using `PerdcompEnrichedCard`.
  - **Key Logic:** `runConsultation` function orchestrates the fetch. It respects a "Shielded" approach where data must be normalized (CNPJ 14 chars) before transit.

- **`PerdcompEnrichedCard.tsx`**: Renders the data.
  - Shows "Quantidade", "Última Consulta", and a breakdown of "Créditos".
  - Handles empty states and error states.

### 2.2. Backend API
**Path:** `app/api/perdecomp/`

The module relies on "Snapshot" architecture. Instead of querying the external provider (Infosimples) every time, it reads from a cached "Snapshot" in Google Sheets.

#### Endpoints:

1.  **`POST /api/perdecomp/snapshot`**
    - **Purpose:** Retrieves the main data payload for a company.
    - **Input:** `{ clienteId: string, cnpj: string, nomeEmpresa: string }`
    - **Logic:**
        1.  **ID Lookup:** Tries to find a row in `perdecomp_snapshot` matching the `clienteId`.
        2.  **Fallback (CNPJ Resolution):** If not found by ID (often due to mismatch between frontend/sheet IDs), it attempts to resolve the correct `clienteId` by searching for the `cnpj` in the snapshot sheet. A warning is logged if this fallback occurs.
        3.  **Snapshot Parse:** If a row is found, parses the JSON payload stored in `Resumo_Ultima_Consulta_JSON_P1` (and `P2`).
        4.  **Legacy Fallback:** If not found in Snapshot, attempts to read from the legacy `PERDECOMP` sheet (Fallback).
        5.  **Empty State:** Returns a structured "empty" object if no data is found (avoiding 500 errors).

2.  **`GET /api/perdecomp/verificar`**
    - **Purpose:** Checks the last consultation date to inform the UI (Green/Yellow badges).
    - **Input:** `?cnpj=...&clienteId=...`
    - **Logic:**
        - Performs a robust/fuzzy search in `perdecomp_snapshot` and `PERDECOMP`.
        - Matches full 14-digit CNPJ or 12-digit Root+Branch.
        - Returns `{ lastConsultation: string | null }`.

3.  **`POST /api/sheets/cnpj`**
    - **Purpose:** "Registers" the intent to consult. Often used to trigger background processes or simply log the request in `leads_exact_spotter` or similar tracking sheets.

### 2.3. Data Layer (Google Sheets)
**Path:** `lib/perdecomp-persist.ts`

The system treats Google Sheets as a relational database.

- **`perdecomp_snapshot` (Table)**
    - **PK:** `cliente_id`
    - **Columns:** `CNPJ`, `Resumo_Ultima_Consulta_JSON_P1`, `Resumo_Ultima_Consulta_JSON_P2`, `Data_Consulta`, `Facts_Count`.
    - **Concept:** Stores the *latest* full state of a company's PER/DCOMP data as a sharded JSON string. This allows for fast reads without re-aggregating thousands of rows.

- **`perdecomp_facts` (Table)**
    - **PK:** Composite (`cliente_id` + `Perdcomp_Numero` + `Row_Hash`)
    - **Columns:** `Perdcomp_Numero`, `Tipo`, `Natureza`, `Valor`, `Situacao`.
    - **Concept:** Stores individual items (facts) for granular analysis.

## 3. Data Models

### 3.1. Company Object (Frontend)
Standardized in `ClientPerdecompComparativo.tsx`:
```typescript
interface Company {
  Cliente_ID: string;     // e.g., "CLT-1234"
  Nome_da_Empresa: string;
  CNPJ_Empresa: string;   // e.g., "12.345.678/0001-99"
}
```

### 3.2. Snapshot Response (API Contract)
The frontend expects this specific shape from `/api/perdecomp/snapshot`:

```typescript
{
  ok: true,
  fonte: 'perdecomp_snapshot' | 'planilha_fallback' | 'empty',
  mappedCount?: number,
  total_perdcomp?: number,
  perdcompResumo: {
    total: number,
    totalSemCancelamento: number,
    canc: number,
    porFamilia: {
      DCOMP: number,
      REST: number,
      RESSARC: number,
      // ...
    },
    porNaturezaAgrupada: Record<string, number>
  },
  header: {
    requested_at: string | null, // ISO Date
    cnpj?: string,
    nomeEmpresa?: string,
    clienteId?: string
  },
  perdcompCodigos?: string[],
  site_receipt?: string | null,
  primeiro?: any
  // ... additional debug fields
}
```

## 4. Critical Nuances for AI Agents

1.  **CNPJ Normalization:**
    - Always pad CNPJs to 14 digits (leading zeros) before querying Sheets.
    - Sheets often contain unformatted or truncated CNPJs. The `verificar` endpoint implements fuzzy matching (12 vs 14 digits), which is critical for data discovery.

2.  **Legacy Support:**
    - The system is migrating from `PERDECOMP` (legacy sheet) to `perdecomp_snapshot`. The code must always check Snapshot first, then Fallback.

3.  **JSON Sharding:**
    - Large JSON payloads in `perdecomp_snapshot` are split into `P1` and `P2` columns to avoid cell character limits. The reader must concatenate them before parsing.

4.  **Error Handling:**
    - If data is missing, return a structured "Empty" object (`total: 0`), NOT a 404 or 500 error, so the UI renders an "Empty Card" instead of crashing.
    - **Robust Header Matching:** When reading sheets, code must handle variable header casings (`CNPJ`, `cnpj`, `CNPJ_Empresa`) as legacy data is inconsistent.

## 5. Development Guidelines

- **Do not change external API Contracts:** The frontend relies on specific keys (`perdcompResumo`, `totalSemCancelamento`).
- **Use `snake_case` for internal variables** mapped from Sheets, but respect the frontend's `PascalCase` for Company objects (`Nome_da_Empresa`) where required by legacy components.
- **Validation:** Always validate `clienteId` and `cnpj` in API routes.
