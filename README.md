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
- Exportable workspace and case incident snapshots for shareable operational handoff artifacts.
- A reproducible demo-reset workflow that restores seeded pending, approved, rejected, and failed-ingestion cases for smoke tests and interview walkthroughs.
- A repo-native smoke harness plus GitHub Actions CI that resets the seeded demo scenario, exports canonical incident evidence, and verifies stable traces before release.
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
npm run smoke:demo
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
- `POST /demo/reset`
- `GET /exports/workspace`
- `GET /exports/cases/:id`

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

1. Add a container-first CI path that boots the API with health/readiness checks and reruns the seeded smoke harness against the running service.
2. Add a minimal Terraform sandbox and deployment notes for disposable environments.
3. Add lightweight telemetry export or collector notes only after the container smoke path is stable.

## Boundaries

- Public addresses and synthetic or seeded cases only.
- No private keys, wallet signing, funds, custody, trading, or automated enforcement.
- Deterministic indicators support review; humans own case decisions.
