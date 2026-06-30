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

## 2026-06-29 slice decision

The storage boundary now uses PostgreSQL directly so the project can defend SQL schema work, containerized runtime setup, CI service dependencies, and replay-safe intake behavior. The service keeps the same JSON request body and adds `Idempotency-Key` as an optional header so the duplicate-intake guarantee is visible without forcing a contract rewrite.

## 2026-06-23 service-boundary decision

The first service boundary stays in TypeScript/Node.js. Go remains a future option if the ingestion or worker boundary grows enough to justify a second runtime.
