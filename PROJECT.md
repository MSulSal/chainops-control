# ChainOps Control

## Product

A human-approved operations workspace for investigating public wallet activity, recording review evidence, and keeping a traceable case history. It is not a trading bot, custody product, legal determination engine, or financial-advice tool.

## First vertical slice

1. A user submits a public wallet address.
2. The service validates it and creates a bounded transaction sample.
3. Storage records the request, normalized transactions, and immutable audit events.
4. Deterministic rules compute transparent risk indicators.
5. A reviewer approves, rejects, or annotates the case; no case action is automatic.
6. The API exposes status, evidence, errors, retries, and trace identifiers.
7. A reviewer workspace surfaces recent cases, provider state, audit history, and failed-ingestion recovery context.

## Build slices

- Slice 1: implemented local TypeScript service with wallet case intake, validation, deterministic transaction fixture, risk result, immutable audit-event log, human approval state, health/readiness endpoints, structured logs, trace IDs, Docker Compose definition, and Node test coverage.
- Slice 2: implemented PostgreSQL persistence in Docker Compose, schema bootstrapping, CI-backed database tests, and duplicate-intake replay through `Idempotency-Key`.
- Slice 3: implemented an Etherscan-compatible read-only ingestion seam, deterministic local fallback, source-metadata persistence, provider-failure audit events, and idempotent recovery tests.
- Slice 4: implemented a bounded Next.js reviewer workspace with case list/detail, provider status, audit timeline, trace IDs, and failed-ingestion visibility backed by the existing API.
- Slice 5: implemented reviewer queue summaries, status counts, wallet/trace query support, and URL-backed filters through the existing API so the workspace can show SQL-backed backlog pressure instead of only a recent-case grid.
- Slice 6: implemented reviewer decision actions in the workspace with required note capture, redirect-safe refresh, and write-path validation through the same API boundary.
- Slice 7: implemented SQL-backed case timeline, review-transition counts, and review-latency analytics in the reviewer workspace.
- Slice 8: implemented request-stage traces and operational metrics for intake, provider fetch, and reviewer decisions through persisted audit-event timing.
- Slice 9: implemented queue-level release guidance plus case-level incident and rollback playbooks derived from persisted case, timing, and audit evidence.
- Slice 10: implemented exportable workspace and case incident snapshots plus release-note updates for shareable operational evidence.
- Slice 11: implemented a reproducible seeded demo/reset workflow so incident snapshots can be regenerated from stable case IDs, trace IDs, notes, and timings without manual database cleanup.
- Slice 12: implemented a repo-native smoke-test harness plus GitHub Actions CI that reset the seeded demo scenario, export canonical workspace/case incident evidence, and assert stable traces plus incident-guide fields before release.
- Slice 13: implemented a container-first CI path that boots the API, checks `/health` and `/ready`, and reruns the seeded smoke harness against the running service before Terraform.
- Slice 14: implemented a provider-free Terraform sandbox contract under `infra/terraform/sandbox` that validates the current runtime inputs and outputs without claiming paid infrastructure.
- Slice 15: implemented a telemetry handoff export that packages the current health/readiness contract, seeded smoke commands, persisted timing evidence, trace samples, and bounded collector notes for observability planning.
- Slice 16: implemented a latest-release record export that packages the current package version, container runtime contract, smoke/build commands, telemetry links, and rollback evidence into one bounded release artifact.
- Slice 17: implemented a bounded OpenTelemetry export seam that turns persisted trace IDs and audit-event timings into local spans plus aggregate metrics without claiming OTLP emission or an external backend.
- Slice 18: implemented a runtime-parity release gate in the live smoke path so `/exports/telemetry`, `/exports/telemetry/opentelemetry`, and `/exports/releases/latest` must match the current seeded parity contract before the container runtime is treated as current.
- Slice 19: implemented a persisted runtime-parity artifact plus API/workspace visibility so the latest `smoke:runtime` result is visible in the reviewer UI and release record without rerunning the runtime smoke path manually.
- Slice 20: implemented GitHub Actions evidence capture that uploads the latest runtime-parity JSON, the latest reachable release record, and a review summary as a downloadable CI artifact for release reviewers.
- Slice 21: threaded GitHub Actions run metadata and artifact retrieval hints into the persisted runtime-parity result, surfaced that review path in the release record, and exposed it in the reviewer workspace so stale-runtime evidence can be tied back to the matching CI run.
- Slice 22: surfaced the latest release-record export directly in the reviewer workspace with a live preview of version, release status, verification commands, focus-case links, rollback triggers, and product boundaries so CI-linked runtime evidence is visible without downloading JSON first.
- Slice 23: surfaced that same release-record focus case, rollback drill evidence, parity summary, and export path directly on the case-detail page so queue-level release context is visible from both the workspace and the active case view.
- Slice 24: added a host-readiness export plus reviewer-workspace diagnostics that report Docker, Compose, Terraform, and live-provider prerequisites so provider-backed sandbox blockers stay explicit on the current host before the next disposable-target attempt.
- Slice 25: threaded that host-readiness artifact into the latest release record and both release-evidence views so runtime parity and provider-backed sandbox blockers now stay attached to one bounded export path.
- Slice 26: extended the GitHub Actions runtime-parity evidence bundle to capture the live host-readiness artifact too, so remote reviewers can download parity status, release-record evidence, and current provider-backed sandbox blockers from one CI package.
- Slice 27: persisted whether that matching GitHub Actions bundle actually captured host-readiness successfully, then surfaced that status plus the expected bundle files directly in the release record and reviewer workspace.
- Slice 28: added a reviewer-triggered failed-ingestion replay action on case detail that reuses the original idempotency key, updates the original case instead of duplicating state, and persists replay request plus recovery-vs-repeat audit evidence.
- Slice 29: exercised that replay path through the seeded smoke and release-evidence flow, added replay-aware release-record fields, and kept the replay story anchored to one exported focus case through the live HTTP boundary.
- Slice 30: extended the seeded replay path to force one deterministic repeated failure before recovery, then surfaced replay outcome history in the release record and both reviewer release-evidence views so operators can compare failed-again versus recovered attempts without leaving the product.

## Success evidence

- One command starts the local stack.
- CI proves unit, integration, API-contract, and browser paths.
- A failure demo shows retries without duplicate records.
- A reviewer workspace connects user action to API, database, trace data, and exportable telemetry handoff artifacts.
- The API can now export a collector-ready local OpenTelemetry-shaped artifact derived from the same persisted evidence already used in the reviewer workflow.
