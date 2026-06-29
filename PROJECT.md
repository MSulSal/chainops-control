# ChainOps Control

## Product

A human-approved operations workspace for investigating public wallet activity, recording review evidence, and keeping a traceable case history. It is not a trading bot, custody product, legal determination engine, or financial-advice tool.

## First vertical slice

1. A user submits a public wallet address.
2. The service validates it and creates a bounded transaction sample.
3. Storage records the request, normalized transactions, and immutable audit events.
4. Deterministic rules compute transparent risk indicators.
5. A reviewer approves, rejects, or annotates the case; no case action is automatic.
6. The service exposes status, evidence, errors, retries, and trace identifiers.

## Build slices

- Slice 1: implemented local TypeScript service with wallet case intake, validation, deterministic transaction fixture, risk result, immutable audit-event log, human approval state, health/readiness endpoints, structured logs, trace IDs, Docker Compose definition, and Node test coverage.
- Slice 2: implemented PostgreSQL persistence in Docker Compose, schema bootstrapping, CI-backed database tests, and duplicate-intake replay through `Idempotency-Key`.
- Slice 3: Ethereum JSON-RPC/Etherscan adapter, validation, idempotent ingestion, retry tests.
- Slice 4: deterministic analytics and SQL-backed case timeline.
- Slice 5: reviewer notes, evidence summaries, and approval/rejection workflow history.
- Slice 6: OpenTelemetry traces/metrics, a minimal Terraform sandbox, and an operational runbook.
- Slice 7: product UI polish, sanitized seed data, architecture diagram, and release notes.

## Success evidence

- One command starts the local stack.
- CI proves unit, integration, API-contract, and browser paths.
- A failure demo shows retries without duplicate records.
- A dashboard connects user action to API, database, worker, and trace data.
