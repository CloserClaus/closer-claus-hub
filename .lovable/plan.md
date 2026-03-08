
Issue diagnosis (from logs and code)
- The failure is not a CPU-time timeout. The worker returned quickly (about 2.8–3.8s) and failed with a deterministic input-validation 400 from the provider.
- Exact failing chain:
  1) Runtime schema fetch for actor `hMvNSpz3JnHgl5jkh` returned 404 (`fetchAndMergeRuntimeSchema`).
  2) System fell back to hardcoded catalog schema where `startUrls` is typed as `string[]`.
  3) `normalizeInputToSchema` coerced `startUrls` from `[{ url: "..." }]` to `["..."]`.
  4) Actor rejected it: `Items in input.startUrls ... do not contain valid URLs`.
  5) Stage 1 produced 0 runs/results, then quality gate failed run.

Systemic fix plan (prevent similar failures for other actors)
1) Add resilient runtime schema resolution (multi-strategy fetch)
- In `process-signal-queue/index.ts`, replace single schema endpoint attempt with a resolver that tries:
  - current endpoint
  - alternative actor schema endpoint variants
  - actor metadata endpoint and extracted schema payloads
- Cache successful runtime schemas per actorId as already done.
- Mark schema source explicitly (`runtime` vs `catalog_fallback`) on actor in-memory metadata.

2) Make URL-array normalization confidence-aware (non-destructive on fallback)
- Update `normalizeInputToSchema` so destructive URL-shape coercions only happen when schema source is `runtime` (trusted).
- If schema source is fallback/unknown, preserve original shape and avoid converting `[{url}] -> [string]`.
- Keep safe scalar coercions (string→number, string→boolean) unchanged.

3) Add self-healing actor start retry for invalid-input
- In `startApifyRunWithFallback`, when error contains `invalid-input` + `startUrls`:
  - auto-retry once with flipped URL shape:
    - `startUrls: [string]` -> `[{url:string}]`
    - `startUrls: [{url}]` -> `[string]`
- Log which variant succeeded and persist that preference in actor cache for this invocation.

4) Correct verified catalog URL field typing baseline
- Update `startUrls` for known Crawlee-style actors to `object[]` in both:
  - `supabase/functions/process-signal-queue/index.ts`
  - `supabase/functions/signal-planner/index.ts`
- This reduces fallback risk when runtime schema cannot be fetched.

5) Add telemetry so regressions surface immediately
- Structured logs:
  - schema source used
  - normalization decisions for URL fields
  - retry flip attempted/succeeded
- Persist compact failure diagnostics to `signal_runs.run_log` for postmortem (actorId, input-shape, error signature).

6) Verification plan
- Run one Stage-1 LinkedIn signal and confirm:
  - no destructive coercion from object[] to string[] when runtime schema is unavailable
  - actor run starts successfully
  - no `invalid-input startUrls` errors
- Run one actor known to require string[] URL inputs and verify adaptive retry does not regress it.

Technical details
- Files targeted:
  - `supabase/functions/process-signal-queue/index.ts` (schema resolver, confidence-aware normalization, retry flip logic, logging)
  - `supabase/functions/signal-planner/index.ts` (verified catalog `startUrls` baseline type corrections)
- No database schema change required.
- This approach addresses both immediate failure and class-wide schema drift/uncertainty across future actors.
