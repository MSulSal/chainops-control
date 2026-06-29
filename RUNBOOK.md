# Runbook

## Local start

```powershell
cd chainops-control
$env:CHAINOPS_DATABASE_URL = "postgres://chainops:chainops@127.0.0.1:5432/chainops"
$env:CHAINOPS_ETHERSCAN_BASE_URL = "https://api.etherscan.io/api"
docker compose up -d postgres
npm test
npm start
```

The service listens on `http://127.0.0.1:4317` by default.

## Smoke test

```powershell
$body = @{ walletAddress = "0x1111111111111111111111111111111111111111" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4317/cases -Body $body -ContentType "application/json" -Headers @{ "x-request-id" = "manual-smoke-1" }
```

Expected result:

- HTTP 201.
- `caseRecord.status` is `pending_review`.
- `caseRecord.risk.level` is `high` for the flagged fixture wallet.
- `caseRecord.sourceMetadata.provider` is `etherscan-account-txlist` when a live base URL is configured, otherwise `deterministic-fixture`.
- Five audit events are written: intake, validation, ingestion, risk, and human-review pending.
- The `x-trace-id` response header matches the supplied request id.
- PostgreSQL stores one case row, three transaction rows, and five audit-event rows.

## Human approval

```powershell
$body = @{ decision = "approve"; note = "reviewed fixture evidence" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4317/cases/<case-id>/approval -Body $body -ContentType "application/json"
```

The service records `HUMAN_APPROVED` or `HUMAN_REJECTED`; no automated enforcement action exists.

## Failure paths

Submit an invalid wallet, such as `bad`, to `POST /cases`. The service returns HTTP 400, logs `request.failed`, and does not create a case or audit event.

If the live provider times out or returns an invalid response, `POST /cases` returns HTTP 202 with `caseRecord.status` set to `ingestion_failed`. PostgreSQL still stores the case row plus a `PROVIDER_FETCH_FAILED` audit event so a second request with the same `Idempotency-Key` can recover the original case when the provider succeeds later.

## Current limits

- Live Ethereum ingestion currently uses an Etherscan-compatible read-only seam; there is no direct JSON-RPC address-indexed worker yet.
- PostgreSQL is local Docker Compose infrastructure only; there is no cloud deployment or managed database.
- Risk indicators are deterministic and human approval is mandatory.
