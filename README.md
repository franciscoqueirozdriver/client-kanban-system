# Client Kanban System

## Exact Spotter integration

Set the environment variables in `.env.local` or Vercel:

```
EXACT_SPOTTER_BASE_URL=https://api.exactspotter.com/v3
EXACT_SPOTTER_TOKEN=... # do not prefix with NEXT_PUBLIC
```

Never use an alternate domain, port or `/api/v3` in the base URL. All Spotter
calls must compose paths with `joinUrl`.
