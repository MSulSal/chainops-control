# Engineering Notes

Use this as the implementation checklist for the product. Keep notes tied to shipped behavior and operational decisions.

## Next.js, React, and TypeScript

- Refresh: Server vs Client Components, Route Handlers, forms, caching, error/loading boundaries, accessible state, TypeScript narrowing and generics.
- Applied in slice 4: server-rendered reviewer workspace, typed API fetch layer, status-driven UI copy, and failed-ingestion visibility without duplicating backend state.
- Applied in slice 5: URL-backed reviewer filters, API-driven summary cards, and typed query parsing for wallet/trace search without coupling the UI directly to PostgreSQL.
- Applied in slice 6: server-action form handling, redirect-safe cache refresh, and required reviewer-note capture over the same API boundary.
- Apply next: SQL-backed reviewer timeline analytics and richer operational breakdowns.
- Docs: https://nextjs.org/docs | https://react.dev/learn | https://www.typescriptlang.org/docs/

## Node.js and TypeScript service

- Refresh: runtime and event loop, typed request/response contracts, schema validation, error handling, abort/timeouts, queues, idempotency, and integration testing.
- Applied in slice 1: REST API, wallet validation, deterministic ingestion fixture, health/readiness, failure responses, structured logs, trace IDs, and Node integration tests.
- Applied in slice 2: optional `Idempotency-Key` header, replay-safe duplicate intake, transaction-bound SQL writes, and database-backed integration tests.
- Docs: https://nodejs.org/docs/latest/api/ | https://www.typescriptlang.org/docs/

## PostgreSQL and SQL

- Refresh: schema constraints, indexes, transactions, upserts, JSONB tradeoffs, migrations, query plans, audit/event tables.
- Applied in slice 2: cases table, normalized transactions table, immutable audit-events table, schema bootstrapping, indexes, and CI-backed PostgreSQL tests.
- Applied in slice 3: JSONB source metadata on cases, persisted provider-failure audit events, and same-case recovery when a previously failed idempotent intake succeeds on retry.
- Applied in slice 5: aggregate queue counts plus status/risk/search filtering from SQL so operational UI state stays backed by the stored case ledger.
- Docs: https://www.postgresql.org/docs/current/

## Ethereum data API

- Refresh: addresses, transactions, blocks, confirmations, JSON-RPC, rate limits, chain/reorg caveats.
- Applied in slice 3: an Etherscan-compatible read-only transaction adapter with bounded history, abort-based timeouts, retry behavior, and deterministic local fallback for tests and offline runs.
- Docs: https://ethereum.org/en/developers/apis/json-rpc/ | https://docs.etherscan.io/

## Docker and Terraform

- Refresh: images/layers, Compose networking, health checks, Terraform state/plan/apply/modules, and environment boundaries.
- Apply: repeatable local stack, container CI, and a minimal disposable infrastructure plan.
- Docs: https://docs.docker.com/get-started/ | https://developer.hashicorp.com/terraform/docs

## Observability and CI/CD

- Refresh: logs vs metrics vs traces, correlation IDs, RED metrics, OpenTelemetry context propagation, CI jobs/artifacts/caches/environments.
- Apply: trace wallet intake through ingestion and reviewer approval; alertable failure metrics; GitHub Actions quality gates.
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
