# Engineering Notes

Use this as the implementation checklist for the product. Keep notes tied to shipped behavior and operational decisions.

## Next.js, React, and TypeScript

- Refresh: Server vs Client Components, Route Handlers, forms, caching, error/loading boundaries, accessible state, TypeScript narrowing and generics.
- Applied in slice 4: server-rendered reviewer workspace, typed API fetch layer, status-driven UI copy, and failed-ingestion visibility without duplicating backend state.
- Applied in slice 5: URL-backed reviewer filters, API-driven summary cards, and typed query parsing for wallet/trace search without coupling the UI directly to PostgreSQL.
- Applied in slice 6: server-action form handling, redirect-safe cache refresh, and required reviewer-note capture over the same API boundary.
- Applied in slice 8: workspace cards for persisted request-stage timings plus case-detail stage traces derived from audit history instead of ad hoc client timers.
- Applied in slice 9: queue-level release guidance and case-level incident/rollback playbooks computed from typed API data so operational response stays explainable inside the existing React boundary.
- Applied in slice 10: export links in the Next.js workspace now hand off bounded JSON artifacts built from the same typed API state the UI renders, which keeps operational evidence shareable without adding a second client-only export model.
- Applied in slice 11: a server-action reset control now restores a deterministic demo dataset through the same API boundary, which is a useful pattern for reproducible smoke tests without inventing a private fixture-only UI.
- Applied in slice 12: a dedicated smoke harness now boots the service, resets the seeded scenario, and asserts stable export evidence over HTTP, which is a useful pattern for proving release readiness without reaching for external test infrastructure too early.
- Docs: https://nextjs.org/docs | https://react.dev/learn | https://www.typescriptlang.org/docs/

## Node.js and TypeScript service

- Refresh: runtime and event loop, typed request/response contracts, schema validation, error handling, abort/timeouts, queues, idempotency, and integration testing.
- Applied in slice 1: REST API, wallet validation, deterministic ingestion fixture, health/readiness, failure responses, structured logs, trace IDs, and Node integration tests.
- Applied in slice 2: optional `Idempotency-Key` header, replay-safe duplicate intake, transaction-bound SQL writes, and database-backed integration tests.
- Applied in slice 8: bounded request timing captured at the API/store boundary for intake and reviewer decisions, then persisted as audit-event details so operational evidence survives refreshes and replays.
- Applied in slice 9: release and rollback guidance stays as deterministic service/UI logic rather than becoming a manual-only note outside the product.
- Applied in slice 10: dedicated export endpoints package queue filters, case evidence, stage traces, and audit history into review-safe incident snapshots without breaking the existing service boundary.
- Applied in slice 11: the demo-reset endpoint replaces existing SQL rows with a seeded incident story so stable traces and review notes can be regenerated on demand.
- Applied in slice 12: the smoke harness reuses the same service and store contracts in-process, which is a good reminder that CI release evidence should exercise the real API boundary instead of reimplementing assertions around internal helpers.
- Applied in slice 15: a telemetry handoff artifact can stay honest by exporting the existing health/readiness, smoke, trace, and audit-ledger evidence first, then leaving collector plumbing as documented next-step work instead of pretending the stack already exists.
- Docs: https://nodejs.org/docs/latest/api/ | https://www.typescriptlang.org/docs/

## PostgreSQL and SQL

- Refresh: schema constraints, indexes, transactions, upserts, JSONB tradeoffs, migrations, query plans, audit/event tables.
- Applied in slice 2: cases table, normalized transactions table, immutable audit-events table, schema bootstrapping, indexes, and CI-backed PostgreSQL tests.
- Applied in slice 3: JSONB source metadata on cases, persisted provider-failure audit events, and same-case recovery when a previously failed idempotent intake succeeds on retry.
- Applied in slice 5: aggregate queue counts plus status/risk/search filtering from SQL so operational UI state stays backed by the stored case ledger.
- Applied in slice 7: SQL-backed review-transition counts, review-latency aggregation, and timeline bucketing from persisted case timestamps so the workspace can explain queue pressure and operational history.
- Applied in slice 8: filtered audit-event scans that summarize intake, provider-fetch, and reviewer-decision timings without adding a second telemetry store before the product needs one.
- Applied in slice 9: persisted queue counts, latency values, and timing summaries now also drive release readiness, watch-state, and hold-state guidance.
- Applied in slice 10: the same stored queue and case evidence now feeds downloadable incident artifacts, which is a useful pattern for support handoff and debugging exercises.
- Applied in slice 11: a deterministic seed set now proves how to reset relational workflow state safely, preserve foreign-key order, and keep case/audit identifiers stable enough for repeatable comparisons.
- Applied in slice 12: stable seeded identifiers make it possible to compare exported incident artifacts across repeated resets while intentionally ignoring only time-relative fields such as export timestamps and current pending age.
- Applied in slice 15: recent trace samples can be handed off as JSON links plus case-export paths, which is a practical bridge between product evidence and future observability tooling.
- Docs: https://www.postgresql.org/docs/current/

## Ethereum data API

- Refresh: addresses, transactions, blocks, confirmations, JSON-RPC, rate limits, chain/reorg caveats.
- Applied in slice 3: an Etherscan-compatible read-only transaction adapter with bounded history, abort-based timeouts, retry behavior, and deterministic local fallback for tests and offline runs.
- Docs: https://ethereum.org/en/developers/apis/json-rpc/ | https://docs.etherscan.io/

## Docker and Terraform

- Refresh: images/layers, Compose networking, health checks, Terraform state/plan/apply/modules, and environment boundaries.
- Apply: repeatable local stack, container CI, and a minimal disposable infrastructure plan.
- Applied in slice 14: a provider-free Terraform sandbox now validates the current API/PostgreSQL/runtime inputs and emits reviewed operator outputs, which is a useful pattern when infrastructure evidence needs to stay truthful to a still-local container boundary.
- Docs: https://docs.docker.com/get-started/ | https://developer.hashicorp.com/terraform/docs

## Observability and CI/CD

- Refresh: logs vs metrics vs traces, correlation IDs, RED metrics, OpenTelemetry context propagation, CI jobs/artifacts/caches/environments.
- Applied in slice 8: trace wallet intake, provider fetch, and reviewer approval through persisted audit-event durations and reviewer workspace cards.
- Applied in slice 9: release/rollback guidance is now computed from persisted queue and case evidence instead of living only in prose runbooks.
- Applied in slice 11: seeded trace IDs and resettable incident evidence make it easier to rehearse rollback and failure-analysis stories without claiming external telemetry ownership.
- Applied in slice 12: GitHub Actions now runs the seeded smoke harness alongside `npm test` and `npm run build:web`, which turns trace-backed incident evidence into a release gate instead of an informal manual check.
- Applied in slice 13: the runtime smoke script now polls `/health` and `/ready` before reusing the same seeded demo/export assertions against the live Docker Compose API, which is a practical pattern for proving startup ordering and runtime contracts without introducing a broader deployment target yet.
- Applied in slice 14: the Terraform sandbox reuses those same health/readiness, demo-reset, and smoke commands as IaC outputs, which is a good reminder that deployment/runbook evidence should point back to the tested runtime contract instead of diverging into a separate undocumented path.
- Applied in slice 15: the telemetry handoff export reuses the same runtime contract plus persisted timing metrics, which is a useful pattern for observability planning when the honest answer is still "collector not provisioned yet."
- Docs: https://opentelemetry.io/docs/languages/ | https://docs.github.com/actions

## Design checks

Be able to explain:

1. Why keep the first service boundary in TypeScript/Node.js instead of adding a new language?
2. How is ingestion idempotent and how are reorgs or provider failures represented?
   Provider failures create `ingestion_failed` state plus immutable audit events; the same idempotency key retries the original case instead of minting a second one.
3. Which decisions are deterministic and which belong to a reviewer?
4. How do schema validation, audit events, and human approval reduce case-review risk?
5. What would change between Docker Compose and a production deployment?
6. Which metric or trace should be inspected first during a failed case run?
7. Why does the reviewer workspace fetch from the API instead of querying PostgreSQL directly?
8. Why keep queue summaries in the API contract instead of computing them only in React?
9. Why keep workflow analytics on `GET /cases` instead of splitting them into a second reporting endpoint this early?
10. Why derive timing metrics from the audit ledger first instead of adding OpenTelemetry infrastructure immediately?
11. Why keep release and rollback guidance as computed product behavior inside the existing API/UI contract instead of introducing a separate incident tool?
12. Why export incident evidence from the same queue and case APIs instead of rebuilding the artifact in the browser?
13. Why reset the seeded demo dataset through the same PostgreSQL tables and API boundary instead of keeping a separate fixture-only demo mode?
14. Why keep the first Terraform slice provider-free instead of forcing a Docker or cloud target that cannot be validated honestly on this host?
