# M7 setup and production privacy checklist

## Activate M7 in development

1. Apply `supabase/migrations/202609270003_security.sql` once after M1-M6,
   in SQL Editor as the database administrator. Keep RLS enabled. The migration
   only revokes application execution privileges on private helper functions.
2. Restart FastAPI from `api/`:
   `.\.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log`
   API version is 0.7.0. Safe application request metadata replaces raw access logs.
3. Restart Next.js with `npm run dev` from `web/`.
4. No new secrets or dependencies. API CORS remains empty because the frontend
   calls the API server-side. If direct browser access is deliberately required,
   set process/deployment variable `API_CORS_ORIGINS` to a JSON array of exact
   trusted origins. Do not add wildcard Vercel preview domains.
5. Verify owner login and existing reads/writes using synthetic data. Do not run
   the test fixture SQL in hosted Supabase; use `npm test` in `supabase/tests/`.

## Production gates (not asserted complete by local tests)

- [ ] Review applied hosted migrations, all 15 application tables' RLS, and RPC ACLs.
- [ ] Disable public signup/anonymous sign-in; verify the sole owner UUID and remove
      unintended project collaborators. Developer/operator roles grant no app access.
- [ ] Review Supabase Auth rate limits and deploy per-IP abuse controls at the trusted
      ingress for login/high-cost traffic. Do not rely on per-process memory counters
      for Vercel/serverless protection. Upload/AI remain disabled pending their limits.
- [ ] HTTPS frontend/API only; platform HSTS, trusted proxy hosts and TLS reviewed.
- [ ] Verify environment access and secret scanning; no service-role key in this app.
- [ ] Review hosting/proxy/error-monitoring logs: turn off body/header/cookie capture,
      redact query strings and identifiers, restrict log readers and set retention.
      Application redaction does not configure provider-managed access logs.
- [ ] Test denied anonymous/developer access against deployed endpoints and database.
- [ ] Verify masked accounts, HttpOnly/SameSite cookies, production Secure cookies,
      no caching of authenticated data, framing denial and Server Action origin checks.
- [ ] No public screenshot bucket. Before M8 activation freeze format/size/pixel limits,
      object ownership, private access, signed URL lifetime, deletion/cleanup TTL and
      provider data-retention settings; test invalid uploads and failed-job cleanup.
- [ ] Confirm no synthetic seed executes against production and no real customer data
      is present in Git, test fixtures, screenshots or AI evaluation data.
- [ ] Confirm audit rows cannot be inserted/edited/deleted by application roles outside
      audited RPCs. Database administrators remain privileged and must be restricted.
- [ ] Verify backup/export/restore with the actual Supabase plan; no recovery guarantee
      is claimed by M7. Production launch and full deployment QA remain M10.

## Verification commands

- `api/`: `.\.venv\Scripts\python -m pytest`; `.\.venv\Scripts\ruff check app tests`;
  `.\.venv\Scripts\ruff format --check app tests`.
- `supabase/tests/`: `npm test` (seven migrations, rollback-only synthetic suites).
- `web/`: `npm test`; `npm run lint`; `npm run typecheck`; `npm run format:check`;
  `npm run build`; `npm run check:client-secrets`.

M8 is not implemented. No uploads, AI provider or storage credential are enabled.
