# Architecture

## Initial shape

```text
Implemented local slice
  -> Next.js reviewer workspace
      -> Node.js / TypeScript REST API
          -> Ethereum provider seam (Etherscan-compatible adapter or deterministic fixture fallback)
          -> PostgreSQL store (cases, source metadata, transactions, audit events)
          -> deterministic risk rules
          -> human approval endpoint
          -> health/readiness endpoints
          -> structured logs and trace IDs

Planned production-shaped progression
  -> Next.js web
      -> Node.js / TypeScript REST API
          -> PostgreSQL (cases, transactions, audit log, idempotency key)
          -> ingestion worker / retry queue
          -> Ethereum JSON-RPC or Etherscan adapter
      -> OpenTelemetry collector
          -> local trace/metric backend
```

## Cloud-native progression

- Local: Docker Compose, explicit environment schema, health/readiness endpoints.
- CI: lint, type-check, unit, integration, contract, E2E, container build, secret scan.
- Runtime: containerized API/worker separation, resource limits, health/readiness, and deployment documentation.
- Infrastructure: minimal Terraform for a disposable sandbox; no paid deployment without approval.
- Operations: structured logs, correlation IDs, traces, RED metrics, retry/dead-letter visibility, rollback runbook.

## Boundaries

- Public addresses and synthetic/seeded cases only.
- No private keys, wallet signing, funds, custody, or automated enforcement.
- Deterministic code computes indicators; a human owns review decisions.
- Every external response is validated and stored with source/time metadata.

## 2026-06-29 provider-slice decision

The current ingestion boundary uses an Etherscan-compatible read-only adapter with timeout and retry behavior, but keeps a deterministic fallback provider for local development and tests. Provider failures are persisted as `ingestion_failed` cases with immutable audit events so the same `Idempotency-Key` can recover the original case instead of creating a duplicate row when a retry succeeds later.

## 2026-06-29 reviewer-workspace decision

The first UI slice is a read-only Next.js workspace that fetches from the existing API instead of reading PostgreSQL directly. That keeps the service boundary explicit, adds real React/Next.js evidence, and makes failed-ingestion and trace visibility shippable without expanding immediately into edit flows, auth, or a second write path.

## 2026-06-30 reviewer-queue decision

Queue summaries, status counts, and wallet/trace filters now stay in the same `GET /cases` API boundary instead of becoming client-only transforms. The API owns filter normalization and aggregate SQL so the workspace can demonstrate operational visibility over real persisted state while keeping the browser contract narrow enough for the next slice to add reviewer actions cleanly.

## 2026-06-30 reviewer-action decision

Reviewer approvals and rejections now originate from the Next.js case-detail page, but the browser still posts only to the existing approval API contract. The API validates a required reviewer note before persistence, and the page uses a redirect-based refresh so the queue and detail views both re-fetch authoritative state after a write instead of mutating optimistic client-only copies.

## 2026-06-30 workflow-analytics decision

Workflow analytics stay attached to the existing `GET /cases` contract so the reviewer workspace can show review transitions, latency, and recent timeline activity without creating a second reporting endpoint or teaching the wrong boundary. Counts and latency remain aggregated from persisted PostgreSQL case and audit state, while the service fills the daily timeline buckets after reading filtered SQL rows so the contract stays stable across local Postgres and in-memory test execution.

## 2026-07-01 request-stage observability decision

Request-stage traces and timing metrics stay inside the existing case and audit ledger instead of introducing a separate collector before the workflow needs one. Intake pipeline timing is persisted on `HUMAN_REVIEW_PENDING` or `PROVIDER_FETCH_FAILED`, provider-fetch timing is persisted on ingestion success/failure events, and reviewer-decision timing is persisted on approval/rejection events. The reviewer workspace then derives aggregate operational metrics from filtered audit rows and shows per-case stage traces from the same stored evidence.

## 2026-07-01 incident-response guidance decision

Release and rollback guidance now stays inside the reviewer workspace as computed product behavior rather than living only in prose docs. Queue-level guidance is derived from persisted failed-ingestion counts, pending-review age, and request-stage timing, while case-level guidance is derived from the same trace and audit events already shown in the detail view. That keeps operational response explainable through the existing API and SQL ledger before adding a separate incident system or telemetry backend.

## 2026-07-01 incident-snapshot export decision

Shareable operational evidence now exports from the same API boundary that already serves the reviewer workspace. `GET /exports/workspace` reuses the current queue filters, SQL-backed analytics, and computed release guide to emit a bounded handoff artifact, while `GET /exports/cases/:id` packages case detail, stage traces, incident guidance, and immutable audit history into a single JSON snapshot. This keeps exports traceable to persisted product state instead of inventing a second reporting store or browser-only export transform.

## 2026-07-02 seeded demo-reset decision

The reproducible demo path resets the same PostgreSQL-backed case, transaction, and audit tables that power the live reviewer workspace instead of introducing a second fixture-only code path. `POST /demo/reset` replaces the current dataset with seeded pending, approved, rejected, and failed-ingestion cases that carry stable case IDs, trace IDs, reviewer notes, and stage timings. This keeps smoke-test and interview evidence attached to the real service boundary while accepting that export timestamps and current pending age remain time-relative.

## 2026-07-02 seeded smoke-harness decision

The next release-evidence step stays inside the repository and the existing HTTP boundary: a dedicated smoke harness starts the service, resets the seeded demo scenario, exports workspace and case artifacts, and asserts stable traces plus incident-guide fields. GitHub Actions runs that harness alongside the test suite and Next.js build so seeded operational evidence becomes a repeatable release gate before containerized CI, Terraform, or broader telemetry work.

## 2026-07-02 container-runtime smoke decision

The next runtime-evidence step keeps using the same seeded smoke assertions, but now points them at the real containerized API instead of only an in-process test server. A dedicated runtime smoke script polls `/health` and `/ready`, then reruns the seeded demo/export flow against `docker compose` infrastructure in CI. That keeps the slice bounded to one service plus PostgreSQL while proving the Docker entrypoint, startup ordering, and readiness contract before adding Terraform or a larger deployment surface.

## 2026-07-03 terraform-sandbox decision

The first Terraform slice stays provider-free on purpose. It captures the current API, PostgreSQL, reviewer workspace, health/readiness, seeded demo reset, and smoke-command contract as validated Terraform inputs and outputs, then stores that reviewed manifest in Terraform state through `terraform_data` instead of pretending a paid or managed runtime already exists. That keeps the infrastructure layer honest to the current product boundary, gives the repo a real IaC surface for interview discussion, and leaves provider-backed Docker or cloud targets for a later host that can actually run Terraform plus the target runtime.

## 2026-07-03 telemetry-handoff decision

The first observability slice also stays provider-free. `GET /exports/telemetry` packages the existing health/readiness paths, seeded smoke commands, release guide, persisted timing analytics, and recent trace samples into one JSON handoff artifact, then adds bounded collector notes that explain how to forward those same signals into a future uptime monitor, collector, or incident process. This keeps the observability story anchored to the current API and audit-ledger contract instead of inventing OpenTelemetry infrastructure, duplicate timers, or a second runtime before the repository can prove those pieces honestly.

## 2026-07-03 release-record decision

The first release-note slice also stays inside the current service boundary. `GET /exports/releases/latest` packages the current package version, local container runtime contract, verification commands, telemetry links, and rollback evidence into one bounded artifact derived from the same queue analytics and case exports already used elsewhere. That keeps version notes attached to tested runtime evidence instead of a separate manual checklist, while still making it explicit that the repository does not yet publish a managed deployment target or external release backend.

## 2026-07-04 OpenTelemetry export decision

The next observability slice still avoids standing up a collector. `GET /exports/telemetry/opentelemetry` reuses the same persisted case and audit evidence to emit a bounded local trace-and-metric artifact: stage spans are derived from recorded event timestamps and duration fields, while aggregate metric points are derived from the same queue analytics already shown in the reviewer workspace. That keeps the OpenTelemetry story truthful to the current runtime while giving the repository a concrete export seam for future collector wiring, runtime parity checks, and interview discussion.

## 2026-07-04 runtime-parity gate decision

The next release gate stays inside the seeded smoke boundary instead of adding a second release service. `npm run smoke:runtime` now treats the live container runtime as stale when `/exports/telemetry`, `/exports/telemetry/opentelemetry`, or `/exports/releases/latest` diverge from the current seeded parity contract after normalizing only the documented time-relative fields. That keeps runtime drift visible through the same HTTP surface the reviewer workspace already depends on, while avoiding a separate parity database, hidden fixture bypass, or managed deployment claim.

## 2026-07-04 persisted parity-result decision

The next release-evidence step still stays local and bounded: the runtime smoke script now writes its latest pass/fail result to `data/runtime-parity/latest.json`, the API serves that artifact at `GET /exports/runtime-parity/latest`, and the release record embeds the same object. That keeps stale-runtime evidence visible to reviewers even when the failing container is not being rechecked live, while still avoiding a second persistence store, background agent, or managed deployment claim.

## 2026-07-05 CI parity-artifact decision

The next reviewability step still stays inside the existing runtime boundary. After `npm run smoke:runtime`, GitHub Actions now captures the persisted runtime-parity JSON, attempts to fetch the live release record while the API is still running, and uploads both plus a summary/README bundle as a workflow artifact. That keeps release-review evidence downloadable even when the parity gate fails, while avoiding GitHub API writebacks, a separate evidence database, or claims of hosted release monitoring.

## 2026-07-05 CI-linked release-evidence decision

The next refinement still stays inside that same boundary. `npm run smoke:runtime` now records GitHub Actions run metadata and artifact retrieval hints directly in the persisted parity artifact when CI context is available. The release record exposes that same review path under `verification.runtimeParity`, and the reviewer workspace surfaces it next to the last parity verdict so an operator can move from stale-runtime evidence to the exact CI bundle without opening workflow YAML or adding a new persistence layer.

## 2026-07-05 release-record workspace-preview decision

The next reviewability step still reuses the existing HTTP contract instead of inventing a second release-summary model in React. The reviewer workspace now fetches `GET /exports/releases/latest` directly and renders a bounded preview of version, release status, verification commands, focus-case links, rollback triggers, and boundaries alongside the persisted runtime-parity verdict. That keeps the UI aligned with the exported artifact reviewers already download, while avoiding duplicate state, a new database table, or a manual checklist that could drift from the API contract.

## 2026-07-06 case-detail release-evidence decision

The next release-evidence step also stays inside that same contract. The case-detail page now fetches `GET /exports/releases/latest` and renders whether the current case is the release focus case, which rollback drill evidence applies, and which export links still anchor the latest release record. That keeps queue-level release guidance visible from the active case view without adding a case-specific release table, duplicating release logic in React, or drifting away from the exported artifact reviewers already use.

## 2026-07-06 host-readiness decision

The next disposable-target step still stays inside the existing API-backed evidence path instead of becoming a separate local checklist. `GET /exports/host-readiness` now probes Docker CLI, Docker Compose, Docker engine connectivity, Terraform CLI, and the configured live-provider base URL from the current host, then exposes one bounded artifact plus reviewer-workspace panel that explains whether the first provider-backed sandbox attempt is ready, incomplete, or blocked. That keeps host-tooling blockers visible alongside the current runtime/release evidence without pretending that the host already passed a provider-backed `terraform apply`.

## 2026-07-06 release-record host-readiness decision

The next release-evidence step still stays inside that same artifact boundary. `GET /exports/releases/latest` now embeds the latest host-readiness snapshot and the `/exports/host-readiness` path alongside runtime parity, verification commands, focus-case links, and rollback evidence so the same release record can explain both runtime drift and why a provider-backed sandbox attempt is still paused on the current host. That keeps release review tied to one exported contract instead of a separate host-only checklist or a second React summary that could drift.

## 2026-07-07 CI host-readiness evidence decision

The next reviewability step still stays inside the existing GitHub Actions artifact flow. `npm run capture:ci-evidence` now downloads `GET /exports/host-readiness` into the same `runtime-parity-evidence` bundle that already carries the persisted runtime-parity JSON, the latest reachable release record, and the capture summary. That keeps remote release review download-only and lets an operator compare stale-runtime evidence, release status, and provider-backed sandbox blockers from one package instead of stitching together multiple exports by hand.

## 2026-07-07 CI host-readiness status decision

The next reviewability step still stays on that same persisted parity contract instead of adding a second CI-summary endpoint. `npm run capture:ci-evidence` now writes whether host-readiness capture succeeded back onto the persisted runtime-parity artifact, and the release record plus reviewer workspace read that same status alongside the expected bundle files. That keeps the UI honest about the difference between "the host is blocked" and "CI never captured the host snapshot" while preserving one artifact path for local runtime evidence, release review, and CI bundle hints.

## 2026-06-29 slice decision

The storage boundary now uses PostgreSQL directly so the project can defend SQL schema work, containerized runtime setup, CI service dependencies, and replay-safe intake behavior. The service keeps the same JSON request body and adds `Idempotency-Key` as an optional header so the duplicate-intake guarantee is visible without forcing a contract rewrite.

## 2026-06-23 service-boundary decision

The first service boundary stays in TypeScript/Node.js. Go remains a future option if the ingestion or worker boundary grows enough to justify a second runtime.
