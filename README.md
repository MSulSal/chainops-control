# ChainOps Control

ChainOps Control is a case-operations service for reviewing public wallet activity with deterministic indicators, reviewer approval, and an immutable audit trail.

## Current Status

- Wallet case intake API.
- Wallet-address validation.
- Deterministic transaction fixture for local development.
- Transparent risk indicators.
- JSON audit adapter for cases, transaction samples, and audit events.
- Human approval/rejection endpoint.
- Health and readiness endpoints.
- Structured logs and request trace IDs.
- Node test coverage for success and failure paths.

## Run

```powershell
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

Example approval body:

```json
{
  "decision": "approve",
  "note": "reviewed fixture evidence"
}
```

## Roadmap

1. Replace the JSON audit adapter with PostgreSQL in Docker Compose.
2. Add idempotency checks for duplicate intake requests.
3. Add a read-only Ethereum data adapter with retry and provider-failure handling.
4. Add a reviewer dashboard for status, evidence, errors, retries, and trace IDs.
5. Add metrics, traces, and release/rollback documentation.

## Boundaries

- Public addresses and synthetic or seeded cases only.
- No private keys, wallet signing, funds, custody, trading, or automated enforcement.
- Deterministic indicators support review; humans own case decisions.
