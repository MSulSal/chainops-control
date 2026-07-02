# Architecture

## Initial shape

```text
Implemented local slice
  -> Next.js reviewer workspace
      -> Node.js / TypeScript REST API
          -> Ethereum provider seam (Etherscan-compatible adapter or deterministic fixture fallback)
          -> PostgreSQL store (cases, source metadata, transactions, audit events)
          -> deterministic risk rules
          -> human approval endpoint
          -> health/readiness endpoints
          -> structured logs and trace IDs

Planned production-shaped progression
  -> Next.js web
      -> Node.js / TypeScript REST API
          -> PostgreSQL (cases, transactions, audit log, idempotency key)
          -> ingestion worker / retry queue
          -> Ethereum JSON-RPC or Etherscan adapter
      -> OpenTelemetry collector
          -> local trace/metric backend
```

## Cloud-native progression

- Local: Docker Compose, explicit environment schema, health/readiness endpoints.
- CI: lint, type-check, unit, integration, contract, E2E, container build, secret scan.
- Runtime: containerized API/worker separation, resource limits, health/readiness, and deployment documentation.
- Infrastructure: minimal Terraform for a disposable sandbox; no paid deployment without approval.
- Operations: structured logs, correlation IDs, traces, RED metrics, retry/dead-letter visibility, rollback runbook.

## Boundaries

- Public addresses and synthetic/seeded cases only.
- No private keys, wallet signing, funds, custody, or automated enforcement.
- Deterministic code computes indicators; a human owns review decisions.
- Every external response is validated and stored with source/time metadata.

## 2026-06-29 provider-slice decision

The current ingestion boundary uses an Etherscan-compatible read-only adapter with timeout and retry behavior, but keeps a deterministic fallback provider for local development and tests. Provider failures are persisted as `ingestion_failed` cases with immutable audit events so the same `Idempotency-Key` can recover the original case instead of creating a duplicate row when a retry succeeds later.

## 2026-06-29 reviewer-workspace decision

The first UI slice is a read-only Next.js workspace that fetches from the existing API instead of reading PostgreSQL directly. That keeps the service boundary explicit, adds real React/Next.js evidence, and makes failed-ingestion and trace visibility shippable without expanding immediately into edit flows, auth, or a second write path.

## 2026-06-30 reviewer-queue decision

Queue summaries, status counts, and wallet/trace filters now stay in the same `GET /cases` API boundary instead of becoming client-only transforms. The API owns filter normalization and aggregate SQL so the workspace can demonstrate operational visibility over real persisted state while keeping the browser contract narrow enough for the next slice to add reviewer actions cleanly.

## 2026-06-30 reviewer-action decision

Reviewer approvals and rejections now originate from the Next.js case-detail page, but the browser still posts only to the existing approval API contract. The API validates a required reviewer note before persistence, and the page uses a redirect-based refresh so the queue and detail views both re-fetch authoritative state after a write instead of mutating optimistic client-only copies.

## 2026-06-30 workflow-analytics decision

Workflow analytics stay attached to the existing `GET /cases` contract so the reviewer workspace can show review transitions, latency, and recent timeline activity without creating a second reporting endpoint or teaching the wrong boundary. Counts and latency remain aggregated from persisted PostgreSQL case and audit state, while the service fills the daily timeline buckets after reading filtered SQL rows so the contract stays stable across local Postgres and in-memory test execution.

## 2026-07-01 request-stage observability decision

Request-stage traces and timing metrics stay inside the existing case and audit ledger instead of introducing a separate collector before the workflow needs one. Intake pipeline timing is persisted on `HUMAN_REVIEW_PENDING` or `PROVIDER_FETCH_FAILED`, provider-fetch timing is persisted on ingestion success/failure events, and reviewer-decision timing is persisted on approval/rejection events. The reviewer workspace then derives aggregate operational metrics from filtered audit rows and shows per-case stage traces from the same stored evidence.

## 2026-07-01 incident-response guidance decision

Release and rollback guidance now stays inside the reviewer workspace as computed product behavior rather than living only in prose docs. Queue-level guidance is derived from persisted failed-ingestion counts, pending-review age, and request-stage timing, while case-level guidance is derived from the same trace and audit events already shown in the detail view. That keeps operational response explainable through the existing API and SQL ledger before adding a separate incident system or telemetry backend.

## 2026-07-01 incident-snapshot export decision

Shareable operational evidence now exports from the same API boundary that already serves the reviewer workspace. `GET /exports/workspace` reuses the current queue filters, SQL-backed analytics, and computed release guide to emit a bounded handoff artifact, while `GET /exports/cases/:id` packages case detail, stage traces, incident guidance, and immutable audit history into a single JSON snapshot. This keeps exports traceable to persisted product state instead of inventing a second reporting store or browser-only export transform.

## 2026-07-02 seeded demo-reset decision

The reproducible demo path resets the same PostgreSQL-backed case, transaction, and audit tables that power the live reviewer workspace instead of introducing a second fixture-only code path. `POST /demo/reset` replaces the current dataset with seeded pending, approved, rejected, and failed-ingestion cases that carry stable case IDs, trace IDs, reviewer notes, and stage timings. This keeps smoke-test and interview evidence attached to the real service boundary while accepting that export timestamps and current pending age remain time-relative.

## 2026-07-02 seeded smoke-harness decision

The next release-evidence step stays inside the repository and the existing HTTP boundary: a dedicated smoke harness starts the service, resets the seeded demo scenario, exports workspace and case artifacts, and asserts stable traces plus incident-guide fields. GitHub Actions runs that harness alongside the test suite and Next.js build so seeded operational evidence becomes a repeatable release gate before containerized CI, Terraform, or broader telemetry work.

## 2026-06-29 slice decision

The storage boundary now uses PostgreSQL directly so the project can defend SQL schema work, containerized runtime setup, CI service dependencies, and replay-safe intake behavior. The service keeps the same JSON request body and adds `Idempotency-Key` as an optional header so the duplicate-intake guarantee is visible without forcing a contract rewrite.

## 2026-06-23 service-boundary decision

The first service boundary stays in TypeScript/Node.js. Go remains a future option if the ingestion or worker boundary grows enough to justify a second runtime.
