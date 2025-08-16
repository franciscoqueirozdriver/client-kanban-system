# Review of differences: Golden vs Preview

## Summary table

| File | Status |
|------|--------|
| app/api/clientes/buscar/route.ts | M |
| app/consultas/perdecomp-comparativo/page.tsx | M |

## Details

### app/api/clientes/buscar/route.ts
- Golden branch returns a reduced object with selected fields for autocomplete.
- Preview branch maps and returns all sheet columns with `_sourceSheet` and `_rowNumber` metadata for enrichment.

### app/consultas/perdecomp-comparativo/page.tsx
- Preview adds features like last consultation check, forced new consultation toggle, and modal for registering a new company.
- Golden branch lacks these enhancements and still displays value totals and "valor por tipo" sections.

