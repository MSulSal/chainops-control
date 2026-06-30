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
