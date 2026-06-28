# Decisions

## Current capabilities

- The service accepts wallet-case intake through an HTTP API.
- Input validation rejects malformed wallet addresses before persistence.
- The service creates a case, a deterministic transaction sample, transparent risk indicators, and immutable audit events.
- Every successful case starts in `pending_review`; a separate approval endpoint records the reviewer decision.
- Structured logs and `x-trace-id` connect the request to the case and audit trail.
- Tests cover the happy path, approval path, high-risk fixture, and invalid-wallet failure path.

## Current limits

- Live Ethereum ingestion is not implemented yet.
- PostgreSQL is not wired yet.
- There are no production users, cloud deployment, paid infrastructure, or regulatory guarantees.

## Storage adapter tradeoff

The first slice uses Node built-ins and a JSON-file adapter to make the workflow runnable without installing dependencies or provisioning services. That is enough to exercise the boundary, validation, audit events, human approval, and failure behavior. The next slice should replace the adapter with PostgreSQL in Docker Compose and keep the same API contract.
