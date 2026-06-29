# Decisions

## Current capabilities

- The service accepts wallet-case intake through an HTTP API.
- Input validation rejects malformed wallet addresses before persistence.
- The service creates a case, a deterministic transaction sample, transparent risk indicators, and immutable audit events in PostgreSQL.
- Every successful case starts in `pending_review`; a separate approval endpoint records the reviewer decision.
- An optional `Idempotency-Key` header replays duplicate intake requests instead of creating a second case.
- Structured logs and `x-trace-id` connect the request to the case and audit trail.
- Tests cover the happy path, approval path, high-risk fixture, and invalid-wallet failure path.

## Current limits

- Live Ethereum ingestion is not implemented yet.
- There are no production users, cloud deployment, paid infrastructure, or regulatory guarantees.

## Storage adapter tradeoff

The first slice used a JSON-file adapter to prove the workflow quickly. The current slice moves to PostgreSQL so the repository can demonstrate schema constraints, SQL-backed audit history, containerized dependencies, and replay-safe writes without changing the request body or pretending a broader production system exists.
