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
- Reviewer decision actions in the Next.js workspace with required note capture, redirect-safe refresh, and persisted review evidence.
- SQL-backed workflow analytics for review transitions, review latency, and recent intake/review timeline visibility.
- Request-stage timing metrics for intake, provider fetch, and reviewer decisions, derived from persisted audit-event details.
- Case-detail stage traces that show completed, failed, and pending operational steps without bypassing the existing API boundary.
- Queue-level release guidance and case-level incident/rollback playbooks derived from persisted case, timing, and audit evidence.
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

1. Add exportable incident snapshots and shareable operational evidence from the reviewer workspace.
2. Add a minimal Terraform sandbox and deployment notes for disposable environments.
3. Add a lightweight local telemetry export path once the product needs a collector beyond persisted audit evidence.

## Boundaries

- Public addresses and synthetic or seeded cases only.
- No private keys, wallet signing, funds, custody, trading, or automated enforcement.
- Deterministic indicators support review; humans own case decisions.
