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

Telemetry handoff export:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4317/exports/telemetry -OutFile telemetry-handoff.json
```

Expected result:

- The JSON artifact includes `/health`, `/ready`, `/demo/reset`, `npm run smoke:demo`, and `npm run smoke:runtime` so an operator or future collector can stay attached to the current runtime boundary.
- Queue summary, release guidance, request-stage timing analytics, and up to five recent trace samples are exported from the same API-backed reviewer state.
- Collector notes stay explicitly bounded: they describe how to forward existing signals into a future observability stack, but they do not claim that an external collector, trace backend, or alerting service already exists.

OpenTelemetry seam export:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4317/exports/telemetry/opentelemetry -OutFile opentelemetry-export.json
```

Expected result:

- The JSON artifact includes a local resource block, filtered queue summary, and links back to the telemetry handoff, workspace snapshot, and latest release record.
- Up to five traces are exported with deterministic hex trace/span IDs, stage names for intake, provider fetch, and reviewer decisions, plus span timing derived from persisted audit-event durations.
- Aggregate metrics for intake, provider fetch, reviewer decisions, and visible queue counts are exported as a bounded local seam for future collector wiring.
- The artifact remains explicit about current limits: it does not emit OTLP traffic, provision a collector, or claim a managed runtime.

Latest release record export:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4317/exports/releases/latest -OutFile latest-release-record.json
```

Expected result:

- The JSON artifact includes the current `package.json` version, the local container runtime channel, and the same queue-level release status currently visible in the reviewer workspace.
- The record lists the release-check commands `npm test`, `npm run smoke:demo`, `npm run smoke:runtime`, and `npm run build:web`.
- The artifact points back to `/exports/telemetry`, `/exports/workspace`, and a focus case export so rollback drills stay attached to the same runtime evidence instead of a separate manual note.
- The record now also embeds the most recent persisted runtime-parity result when one exists, including the checked base URL, export-path statuses, latest failure summary, and any matching GitHub Actions review-artifact metadata.

Latest runtime-parity artifact:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4317/exports/runtime-parity/latest -OutFile runtime-parity-latest.json
```

Expected result:

- The JSON artifact returns the latest pass/fail result written by `npm run smoke:runtime`.
- It includes the checked base URL, the compared export paths, the ignored time-relative fields, and a per-export status summary.
- A failed result should be treated as stale-runtime evidence until a later `npm run smoke:runtime` pass replaces it.

Container/runtime smoke command:

```powershell
docker compose up -d api
npm run smoke:runtime
docker compose down -v
```

Expected result:

- The command waits for `GET /health` and `GET /ready` to pass against the running API container before exercising the seeded workflow.
- The same seeded export assertions from `npm run smoke:demo` pass through the live HTTP boundary backed by Docker Compose PostgreSQL.
- The command compares `/exports/telemetry`, `/exports/telemetry/opentelemetry`, and `/exports/releases/latest` against the current seeded parity contract after normalizing only the documented time-relative fields.
- If any required export is missing or diverges from that contract, treat the runtime as stale and do not treat the release record as current.
- If startup or readiness stalls, the command fails with the last observed health/readiness error so runtime ordering problems are visible in CI.
- The command writes its latest pass/fail result to `data/runtime-parity/latest.json`, which the reviewer workspace and release record reuse directly.
- When GitHub Actions context is present, the same artifact also records the matching run URL, artifact name, expected bundle files, and a review hint for downloading the CI evidence bundle.

GitHub Actions evidence capture:

```powershell
npm run capture:ci-evidence
```

Expected result:

- The command copies the latest persisted runtime-parity JSON into `artifacts/runtime-parity/runtime-parity-latest.json`.
- It attempts to download the live `GET /exports/releases/latest` artifact into the same folder while the API container is still running.
- It writes `artifacts/runtime-parity/ci-evidence-summary.json` and `artifacts/runtime-parity/README.md` so a reviewer can inspect the parity status, release-record capture status, and matching GitHub Actions run metadata after downloading the CI artifact.
- The CI workflow uploads that folder as the `runtime-parity-evidence` artifact on every run, including failed parity runs.
- The reviewer workspace and release record now reuse the same run URL and artifact-name hints from the persisted parity result, so the operator can move from a stale verdict to the matching GitHub Actions bundle without opening the workflow file first.
- The reviewer workspace also previews the latest release record from that same contract, including version, release status, required commands, focus-case links, rollback triggers, and product boundaries, before any JSON download is needed.

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
15. Use `Export telemetry handoff` from the workspace and confirm the JSON includes the health/readiness paths, smoke commands, queue evidence, trace samples, and bounded collector notes.
16. Use `Export OpenTelemetry seam` from the workspace and confirm the JSON includes deterministic hex trace/span IDs, local spans for each recorded workflow stage, aggregate metrics, and explicit no-collector boundaries.
17. Use `Export latest release record` from the workspace and confirm the JSON includes the current version, the required verification commands, and rollback evidence tied to a visible trace or case export.
18. Confirm the release record section shows the last runtime parity result, including pass/fail status, checked base URL, per-export evidence, and the GitHub Actions artifact/run hint when the latest parity result came from CI.
19. Confirm the release record section also previews the required commands, focus-case links, rollback triggers, and boundaries from the same exported artifact instead of only download links.
20. Use `Export latest runtime parity` when available and confirm the JSON matches the pass/fail summary shown in the release record section.

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
- The telemetry handoff export is an operator and planning artifact only. It does not emit OTLP traffic, scrape metrics, or provision observability infrastructure on its own.
- The OpenTelemetry export is also a bounded local artifact only. It reuses stored audit evidence to shape spans and metrics, but it does not send telemetry to a collector or backend.
- The latest release record is a bounded handoff artifact only. It does not publish a deployment, mutate infrastructure, or claim a managed release target.
- The persisted runtime-parity artifact is also bounded to local evidence only. It records the last smoke result on disk, but it does not prove a hosted deployment target or continuous monitor.
- Runtime parity is also bounded to the local seeded contract. It proves that the current container matches the shipped export surface; it does not prove a hosted deployment target.
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
