# Runbook

## Local start

```powershell
cd chainops-control
$env:CHAINOPS_DATABASE_URL = "postgres://chainops:chainops@127.0.0.1:5432/chainops"
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
- Five audit events are written: intake, validation, ingestion, risk, and human-review pending.
- The `x-trace-id` response header matches the supplied request id.
- PostgreSQL stores one case row, three transaction rows, and five audit-event rows.

## Human approval

```powershell
$body = @{ decision = "approve"; note = "reviewed fixture evidence" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4317/cases/<case-id>/approval -Body $body -ContentType "application/json"
```

The service records `HUMAN_APPROVED` or `HUMAN_REJECTED`; no automated enforcement action exists.

## Failure path

Submit an invalid wallet, such as `bad`, to `POST /cases`. The service returns HTTP 400, logs `request.failed`, and does not create a case or audit event.

## Current limits

- Transaction ingestion is deterministic synthetic data, not a live Ethereum provider call.
- PostgreSQL is local Docker Compose infrastructure only; there is no cloud deployment or managed database.
- Risk indicators are deterministic and human approval is mandatory.
