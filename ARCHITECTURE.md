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

## 2026-06-29 slice decision

The storage boundary now uses PostgreSQL directly so the project can defend SQL schema work, containerized runtime setup, CI service dependencies, and replay-safe intake behavior. The service keeps the same JSON request body and adds `Idempotency-Key` as an optional header so the duplicate-intake guarantee is visible without forcing a contract rewrite.

## 2026-06-23 service-boundary decision

The first service boundary stays in TypeScript/Node.js. Go remains a future option if the ingestion or worker boundary grows enough to justify a second runtime.
