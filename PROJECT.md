# ChainOps Control

## Product

A human-approved operations workspace for investigating public wallet activity, recording review evidence, and keeping a traceable case history. It is not a trading bot, custody product, legal determination engine, or financial-advice tool.

## First vertical slice

1. A user submits a public wallet address.
2. The service validates it and creates a bounded transaction sample.
3. Storage records the request, normalized transactions, and immutable audit events.
4. Deterministic rules compute transparent risk indicators.
5. A reviewer approves, rejects, or annotates the case; no case action is automatic.
6. The API exposes status, evidence, errors, retries, and trace identifiers.
7. A reviewer workspace surfaces recent cases, provider state, audit history, and failed-ingestion recovery context.

## Build slices

- Slice 1: implemented local TypeScript service with wallet case intake, validation, deterministic transaction fixture, risk result, immutable audit-event log, human approval state, health/readiness endpoints, structured logs, trace IDs, Docker Compose definition, and Node test coverage.
- Slice 2: implemented PostgreSQL persistence in Docker Compose, schema bootstrapping, CI-backed database tests, and duplicate-intake replay through `Idempotency-Key`.
- Slice 3: implemented an Etherscan-compatible read-only ingestion seam, deterministic local fallback, source-metadata persistence, provider-failure audit events, and idempotent recovery tests.
- Slice 4: implemented a bounded Next.js reviewer workspace with case list/detail, provider status, audit timeline, trace IDs, and failed-ingestion visibility backed by the existing API.
- Slice 5: implemented reviewer queue summaries, status counts, wallet/trace query support, and URL-backed filters through the existing API so the workspace can show SQL-backed backlog pressure instead of only a recent-case grid.
- Slice 6: implemented reviewer decision actions in the workspace with required note capture, redirect-safe refresh, and write-path validation through the same API boundary.
- Slice 7: implemented SQL-backed case timeline, review-transition counts, and review-latency analytics in the reviewer workspace.
- Slice 8: implemented request-stage traces and operational metrics for intake, provider fetch, and reviewer decisions through persisted audit-event timing.
- Slice 9: implemented queue-level release guidance plus case-level incident and rollback playbooks derived from persisted case, timing, and audit evidence.
- Slice 10: implemented exportable workspace and case incident snapshots plus release-note updates for shareable operational evidence.
- Slice 11: implemented a reproducible seeded demo/reset workflow so incident snapshots can be regenerated from stable case IDs, trace IDs, notes, and timings without manual database cleanup.
- Slice 12: implemented a repo-native smoke-test harness plus GitHub Actions CI that reset the seeded demo scenario, export canonical workspace/case incident evidence, and assert stable traces plus incident-guide fields before release.
- Slice 13: add a container-first CI path that boots the API, checks health/readiness, and reruns the seeded smoke harness against the running service before Terraform.

## Success evidence

- One command starts the local stack.
- CI proves unit, integration, API-contract, and browser paths.
- A failure demo shows retries without duplicate records.
- A reviewer workspace connects user action to API, database, and trace data.
