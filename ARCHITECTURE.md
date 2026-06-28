# Architecture

## Initial shape

```text
Implemented local slice
  -> Node.js / TypeScript REST API
      -> JSON audit adapter (cases, deterministic transactions, audit events)
      -> deterministic risk rules
      -> human approval endpoint
      -> health/readiness endpoints
      -> structured logs and trace IDs

Planned production-shaped progression
  -> Next.js web
      -> Node.js / TypeScript REST API
          -> PostgreSQL (cases, transactions, audit log)
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

## 2026-06-27 slice decision

The first runnable service uses a JSON-file audit adapter instead of pretending PostgreSQL exists before the local database is wired. The API contract and audit-event shape are intentionally close to the planned SQL records, so the next slice can replace the adapter with PostgreSQL and keep the behavior tests focused on the workflow rather than storage internals.

## 2026-06-23 service-boundary decision

The first service boundary stays in TypeScript/Node.js. Go remains a future option if the ingestion or worker boundary grows enough to justify a second runtime.
