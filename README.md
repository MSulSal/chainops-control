# ChainOps Control

ChainOps Control is a case-operations service for reviewing public wallet activity with deterministic indicators, reviewer approval, and an immutable audit trail.

## Current Status

- Wallet case intake API.
- Wallet-address validation.
- Deterministic transaction fixture for local development.
- Transparent risk indicators.
- PostgreSQL-backed cases, transaction samples, and immutable audit events.
- Duplicate-intake protection through the `Idempotency-Key` header.
- Human approval/rejection endpoint.
- Health and readiness endpoints.
- Structured logs and request trace IDs.
- Node test coverage for success and failure paths.

## Run

```powershell
docker compose up -d postgres
$env:CHAINOPS_DATABASE_URL = "postgres://chainops:chainops@127.0.0.1:5432/chainops"
npm test
npm start
```

The service listens on `http://127.0.0.1:4317`.

## API

- `GET /health`
- `GET /ready`
- `POST /cases`
- `GET /cases/:id`
- `POST /cases/:id/approval`

Example intake body:

```json
{
  "walletAddress": "0x1111111111111111111111111111111111111111"
}
```

Optional intake header:

```text
Idempotency-Key: wallet-1111
```

Example approval body:

```json
{
  "decision": "approve",
  "note": "reviewed fixture evidence"
}
```

## Roadmap

1. Add a read-only Ethereum data adapter with retry and provider-failure handling.
2. Add a reviewer dashboard for status, evidence, errors, retries, and trace IDs.
3. Add metrics, traces, and release/rollback documentation.

## Boundaries

- Public addresses and synthetic or seeded cases only.
- No private keys, wallet signing, funds, custody, trading, or automated enforcement.
- Deterministic indicators support review; humans own case decisions.
