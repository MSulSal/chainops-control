# Decisions

## Current capabilities

- The service accepts wallet-case intake through an HTTP API.
- Input validation rejects malformed wallet addresses before persistence.
- The service creates a case, persists transaction-source metadata, records transparent risk indicators, and keeps immutable audit events in PostgreSQL.
- Every successful case starts in `pending_review`; a separate approval endpoint records the reviewer decision.
- An optional `Idempotency-Key` header replays duplicate intake requests instead of creating a second case.
- Provider failures persist as `ingestion_failed` cases and can recover the same case on retry when the original idempotency key is reused.
- Structured logs and `x-trace-id` connect the request to the case and audit trail.
- A Next.js reviewer workspace now reads recent cases and case detail from the API so the product shows visible frontend evidence without weakening the service boundary.
- The reviewer workspace now uses the same API to retrieve queue counts and apply status/risk/search filters, so operational visibility stays SQL-backed instead of becoming browser-only state.
- The reviewer workspace now uses that same API contract to retrieve review-transition counts, latency summaries, and recent timeline activity, so workflow measurement stays attached to persisted backend state instead of drifting into a separate UI-only report.
- The local demo path now resets the same SQL-backed workflow to a seeded incident scenario, so exported evidence and walkthroughs can be regenerated without hand-editing the database.
- The repository now includes a dedicated smoke harness and CI workflow that verify seeded incident exports through the same HTTP boundary before release.
- Tests cover the happy path, approval path, high-risk fixture, invalid-wallet failure path, provider-timeout persistence, and recovery on retry.

## Current limits

- Live ingestion currently uses an Etherscan-compatible address-history seam; a worker-backed JSON-RPC flow is still planned.
- There are no production users, cloud deployment, paid infrastructure, or regulatory guarantees.

## Storage adapter tradeoff

The first slice used a JSON-file adapter to prove the workflow quickly. The current slice moves to PostgreSQL so the repository can demonstrate schema constraints, SQL-backed audit history, containerized dependencies, and replay-safe writes without changing the request body or pretending a broader production system exists.

## Provider seam tradeoff

The service uses an Etherscan-compatible read-only provider seam for the first live-ingestion slice because it exposes bounded address history directly, which keeps the implementation small enough for a 3-4 day core. A deterministic fixture provider remains available for offline development and tests so the product can demonstrate retries, failure persistence, and case recovery without depending on paid infrastructure.

## Reviewer workspace tradeoff

The first frontend slice stays read-only and API-backed. That makes the product demonstrably full-stack while avoiding a premature second write surface, direct database coupling from the UI, or fake reviewer workflows that would add scope faster than evidence.

## Reviewer queue tradeoff

Queue summaries and filters live in the API contract instead of only in React state so the same backend boundary can power both the browser workspace and future automation or reporting clients. This keeps the query logic testable at the service layer and avoids teaching the wrong lesson that operational backlog visibility belongs only in the UI.

## Reviewer analytics tradeoff

Review transitions, latency, and timeline metrics now live on `GET /cases` instead of a separate reporting route because the product still has one reviewer workflow and one source of truth. Keeping those analytics on the same contract demonstrates SQL-backed operational visibility without adding a second public surface that would need separate authorization, caching, and contract tests before the core workflow is finished.

## Seeded demo reset tradeoff

The demo-reset path rewrites the same `cases`, `transactions`, and `audit_events` tables used by the reviewer workflow instead of adding a second in-memory fixture mode. That keeps the smoke-test story honest to the real service boundary and makes exported case evidence repeatable, but it also means the reset is intentionally local-development behavior rather than a production-safe administrative action.

## Seeded smoke harness tradeoff

The first release gate for seeded incident evidence runs the service in-process through the same HTTP endpoints instead of standing up Docker, browsers, or external telemetry first. That keeps CI fast and reviewable while still proving that demo reset plus workspace/case exports remain stable across repeated runs. The next step is to rerun the same path against the runtime entrypoint so container startup and health/readiness behavior become visible too.
