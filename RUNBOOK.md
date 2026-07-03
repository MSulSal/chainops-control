# Runbook

## Local start

```powershell
cd chainops-control
$env:CHAINOPS_DATABASE_URL = "postgres://chainops:chainops@127.0.0.1:5432/chainops"
$env:CHAINOPS_ETHERSCAN_BASE_URL = "https://api.etherscan.io/api"
docker compose up -d postgres
npm test
npm run smoke:demo
npm start
npm run start:web
```

The service listens on `http://127.0.0.1:4317` by default.
The reviewer workspace listens on `http://127.0.0.1:3000` by default and expects the API at `http://127.0.0.1:4317` unless `CHAINOPS_API_BASE_URL` overrides it.

## Smoke test

Repo-native seeded smoke command:

```powershell
npm run smoke:demo
```

Expected result:

- The command starts an in-memory service instance, resets the seeded incident scenario, exports workspace and case snapshots, and exits successfully.
- The failed case stays `44444444-4444-4444-8444-444444444444` with trace `trace-demo-provider-timeout`.
- The workspace export still contains `trace-demo-pending-high`, `trace-demo-approved-low`, and `trace-demo-provider-timeout` after a reset, an extra intake, and a second reset.
- Time-relative fields such as `generatedAt` and current pending-review age may change, but seeded identifiers, statuses, notes, stage outcomes, and incident guidance must stay stable.

Container/runtime smoke command:

```powershell
docker compose up -d api
npm run smoke:runtime
docker compose down -v
```

Expected result:

- The command waits for `GET /health` and `GET /ready` to pass against the running API container before exercising the seeded workflow.
- The same seeded export assertions from `npm run smoke:demo` pass through the live HTTP boundary backed by Docker Compose PostgreSQL.
- If startup or readiness stalls, the command fails with the last observed health/readiness error so runtime ordering problems are visible in CI.

## Terraform sandbox

Use the Terraform sandbox when the goal is to review or hand off the disposable runtime contract without claiming that this repository already provisions paid infrastructure.

```powershell
cd infra/terraform/sandbox
Copy-Item terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply -auto-approve
terraform output operator_runbook
terraform destroy -auto-approve
```

Expected result:

- Terraform validates the current API host/port, reviewer port, PostgreSQL URL, image references, and optional Etherscan base URL before writing state.
- `sandbox_manifest` output mirrors the current service contract: API base URL, reviewer base URL, `/health`, `/ready`, `/demo/reset`, smoke commands, and the environment variables that the API container expects.
- `operator_runbook` output lists the exact docker-compose, smoke, and reviewer commands needed to exercise the same runtime boundary manually.
- No provider-backed infrastructure is created in this slice; `terraform apply` records the reviewed disposable contract in state through `terraform_data` so the next provider-backed target can reuse the same inputs and outputs instead of inventing a second deployment story.

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

## Reviewer workspace smoke test

1. Open `http://127.0.0.1:3000`.
2. Confirm the new case appears in the recent-case grid and that the summary cards update with the expected pending-review and high-risk counts.
3. Confirm the workflow analytics section shows entered-review counts and that the case timeline adds the new intake day.
4. Confirm the operational metrics section shows non-`n/a` timing for intake pipeline and provider fetch after at least one successful case.
5. If the case is later approved or rejected, confirm the review-latency cards, reviewer-decision timing card, and timeline reviewed counts update after refresh.
6. Confirm the release response guide changes between `Ready`, `Watch`, and `Hold` as queue failures or stale pending-review cases appear.
7. Confirm the guide's rollback note only recommends reverting a recent provider/runtime change when the failure pattern lines up with a change window.
8. Open a failed-ingestion case and confirm the incident guide references the same trace ID, provider error, and replay-safe retry path shown in the audit history.
9. Use the filter bar to search by wallet suffix or trace ID and confirm the URL preserves the active query.
10. Open the case detail page and confirm the provider summary, trace ID, transaction sample, stage-trace cards, and audit timeline render.
11. Submit an approval or rejection from the case detail page with a note and confirm the page refreshes with the new status, persisted reviewer note, and reviewer-decision timing.
12. If the provider times out, confirm the workspace shows `Ingestion failed`, the provider/intake timing remains visible, and retry-safe guidance references reusing the same idempotency key.
13. Use `Export workspace snapshot` and confirm the browser downloads JSON with the active filters, queue summary, release guide, and visible-case evidence.
14. Use `Export case snapshot` from a detail page and confirm the JSON includes the case record, stage trace, incident guide, and immutable audit events.

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
- Reviewer decisions now flow through the workspace, but still post to the same API boundary instead of writing directly to PostgreSQL.
- Workflow analytics and request-stage timing currently come from persisted audit-event details through the reviewer API; there is still no external collector, trace backend, or alerting system.
- Release and rollback guidance are operational playbooks derived from queue and case evidence; they do not trigger deployment changes automatically.
- GitHub Actions now proves the repo-native test path, the in-process seeded smoke path, the containerized API health/readiness path, and the live seeded runtime smoke path before the Next.js build. It still does not cover a separate worker, managed database, or paid deployment target.
- The Terraform sandbox currently models and validates the disposable runtime contract only. It does not yet provision Docker, a VM, a managed database, or a cloud network.

## Demo reset

Use the seeded demo reset when the workspace needs a known incident story before smoke testing, exporting evidence, or walking through the product in an interview.

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4317/demo/reset
```

Expected result:

- The workspace resets to four seeded cases: one pending review, one approved, one rejected, and one failed ingestion.
- The seeded traces include `trace-demo-provider-timeout`, `trace-demo-pending-high`, and `trace-demo-approved-low`.
- `GET /exports/workspace` and the seeded case export URLs can be regenerated immediately after reset.
- Case IDs, trace IDs, statuses, reviewer notes, and stage durations remain stable across resets; `generatedAt` and current pending-review age remain time-relative.
