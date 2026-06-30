# ChainOps Control

ChainOps Control is a case-operations service for reviewing public wallet activity with deterministic indicators, reviewer approval, and an immutable audit trail.

## Current Status

- Wallet case intake API.
- Wallet-address validation.
- Read-only Ethereum ingestion seam with a deterministic local fallback.
- Transparent risk indicators.
- PostgreSQL-backed cases, transaction samples, source metadata, and immutable audit events.
- Read-only Next.js reviewer workspace for case list, case detail, provider status, audit timeline, and trace IDs.
- API-backed reviewer queue summaries, status counts, wallet/trace search, and URL-driven filters.
- Duplicate-intake protection through the `Idempotency-Key` header.
- Provider timeout/failure persistence and idempotent recovery on retry.
- Human approval/rejection endpoint.
- Health and readiness endpoints.
- Structured logs and request trace IDs.
- Node test coverage for success and failure paths.

## Run

```powershell
docker compose up -d postgres
$env:CHAINOPS_DATABASE_URL = "postgres://chainops:chainops@127.0.0.1:5432/chainops"
$env:CHAINOPS_ETHERSCAN_BASE_URL = "https://api.etherscan.io/api"
npm test
npm start
npm run start:web
```

The service listens on `http://127.0.0.1:4317`.
The reviewer workspace listens on `http://127.0.0.1:3000` and reads the API through `CHAINOPS_API_BASE_URL` when that variable is set. Otherwise it defaults to the local API at `http://127.0.0.1:4317`.

Without `CHAINOPS_ETHERSCAN_BASE_URL`, the service uses a deterministic local fixture provider so the workflow stays runnable without external credentials.

## API

- `GET /health`
- `GET /ready`
- `GET /cases`
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

1. Add reviewer decision actions to the workspace with note capture and failure-state handling.
2. Add a SQL-backed case timeline and reviewer queue analytics.
3. Add metrics, traces, and release/rollback documentation.
4. Add a minimal Terraform sandbox and deployment notes for disposable environments.

## Boundaries

- Public addresses and synthetic or seeded cases only.
- No private keys, wallet signing, funds, custody, trading, or automated enforcement.
- Deterministic indicators support review; humans own case decisions.
