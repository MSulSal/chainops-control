# Decisions

## Current capabilities

- The service accepts wallet-case intake through an HTTP API.
- Input validation rejects malformed wallet addresses before persistence.
- The service creates a case, persists transaction-source metadata, records transparent risk indicators, and keeps immutable audit events in PostgreSQL.
- Every successful case starts in `pending_review`; a separate approval endpoint records the reviewer decision.
- An optional `Idempotency-Key` header replays duplicate intake requests instead of creating a second case.
- Provider failures persist as `ingestion_failed` cases and can recover the same case on retry when the original idempotency key is reused.
- Structured logs and `x-trace-id` connect the request to the case and audit trail.
- A Next.js reviewer workspace now reads recent cases and case detail from the API so the product shows visible frontend evidence without weakening the service boundary.
- The reviewer workspace now uses the same API to retrieve queue counts and apply status/risk/search filters, so operational visibility stays SQL-backed instead of becoming browser-only state.
- The reviewer workspace now uses that same API contract to retrieve review-transition counts, latency summaries, and recent timeline activity, so workflow measurement stays attached to persisted backend state instead of drifting into a separate UI-only report.
- The local demo path now resets the same SQL-backed workflow to a seeded incident scenario, so exported evidence and walkthroughs can be regenerated without hand-editing the database.
- The repository now includes a dedicated smoke harness and CI workflow that verify seeded incident exports through the same HTTP boundary before release.
- Tests cover the happy path, approval path, high-risk fixture, invalid-wallet failure path, provider-timeout persistence, and recovery on retry.

## Current limits

- Live ingestion currently uses an Etherscan-compatible address-history seam; a worker-backed JSON-RPC flow is still planned.
- There are no production users, cloud deployment, paid infrastructure, or regulatory guarantees.

## Storage adapter tradeoff

The first slice used a JSON-file adapter to prove the workflow quickly. The current slice moves to PostgreSQL so the repository can demonstrate schema constraints, SQL-backed audit history, containerized dependencies, and replay-safe writes without changing the request body or pretending a broader production system exists.

## Provider seam tradeoff

The service uses an Etherscan-compatible read-only provider seam for the first live-ingestion slice because it exposes bounded address history directly, which keeps the implementation small enough for a 3-4 day core. A deterministic fixture provider remains available for offline development and tests so the product can demonstrate retries, failure persistence, and case recovery without depending on paid infrastructure.

## Reviewer workspace tradeoff

The first frontend slice stays read-only and API-backed. That makes the product demonstrably full-stack while avoiding a premature second write surface, direct database coupling from the UI, or fake reviewer workflows that would add scope faster than evidence.

## Reviewer queue tradeoff

Queue summaries and filters live in the API contract instead of only in React state so the same backend boundary can power both the browser workspace and future automation or reporting clients. This keeps the query logic testable at the service layer and avoids teaching the wrong lesson that operational backlog visibility belongs only in the UI.

## Reviewer analytics tradeoff

Review transitions, latency, and timeline metrics now live on `GET /cases` instead of a separate reporting route because the product still has one reviewer workflow and one source of truth. Keeping those analytics on the same contract demonstrates SQL-backed operational visibility without adding a second public surface that would need separate authorization, caching, and contract tests before the core workflow is finished.

## Seeded demo reset tradeoff

The demo-reset path rewrites the same `cases`, `transactions`, and `audit_events` tables used by the reviewer workflow instead of adding a second in-memory fixture mode. That keeps the smoke-test story honest to the real service boundary and makes exported case evidence repeatable, but it also means the reset is intentionally local-development behavior rather than a production-safe administrative action.

## Seeded smoke harness tradeoff

The first release gate for seeded incident evidence runs the service in-process through the same HTTP endpoints instead of standing up Docker, browsers, or external telemetry first. That keeps CI fast and reviewable while still proving that demo reset plus workspace/case exports remain stable across repeated runs. The next step is to rerun the same path against the runtime entrypoint so container startup and health/readiness behavior become visible too.

## Telemetry handoff tradeoff

The first observability-facing artifact exports the current runtime contract and evidence instead of pretending the repository already owns a collector. That keeps the implementation reviewable and resume-safe: health/readiness, smoke commands, request-stage timings, release guidance, and trace samples are real product signals today, while OTLP pipelines, dashboards, and alerts remain documented future wiring. The tradeoff is that the repository still lacks live metric scraping or trace ingestion, but the handoff JSON makes that gap explicit and gives the next slice a stable contract to build on.

## OpenTelemetry export tradeoff

The next slice exports OpenTelemetry-shaped spans and metrics as a local JSON artifact instead of wiring a real SDK, collector, or backend on an unvalidated host. That keeps the runtime story honest while still demonstrating how existing trace IDs, stage timings, and queue aggregates can map into collector-ready structures. The tradeoff is that this slice proves the contract and mapping discipline, not live telemetry delivery.

## Runtime parity gate tradeoff

The next release gate reuses the seeded smoke contract and compares the live telemetry, OpenTelemetry, and release-record exports directly instead of inventing a second release-verification service. That keeps stale container drift visible at the same HTTP boundary reviewers already use, and it stays honest by normalizing only documented time-relative fields. The tradeoff is that parity remains a local runtime proof rather than a hosted-deployment guarantee.

## Persisted parity-result tradeoff

The next evidence step persists the last runtime-parity result as a local JSON artifact and serves it back through the same API/reviewer surface instead of inventing a new SQL table or background status service. That keeps stale-runtime evidence visible after a failed smoke run and makes release records easier to review, while keeping the scope bounded to local operator evidence rather than claiming continuous runtime monitoring.

## CI parity-artifact tradeoff

The next evidence step uploads the persisted runtime-parity result and any reachable live release record as a GitHub Actions artifact instead of pushing status back into the product or requiring reviewers to rerun the smoke path locally. That keeps failure evidence downloadable from CI and tied to the exact workflow run, while staying honest about the current boundary: the repository still does not claim hosted runtime monitoring, GitHub API issue automation, or a separate evidence store.

## CI-linked release-evidence tradeoff

The next reviewability step stores GitHub Actions run metadata and artifact retrieval hints on the existing runtime-parity artifact instead of adding a release-evidence table or a second API endpoint. That keeps the release record and reviewer workspace aligned on one persisted truth source while making the CI evidence path explicit enough for failure triage.

## Release-record workspace preview tradeoff

The next UI step renders the existing release-record export directly in the reviewer workspace instead of hand-maintaining a second release summary inside React. That keeps version, verification commands, rollback triggers, focus-case links, and explicit boundaries tied to the same API artifact that CI and operators already download, while avoiding duplicated client state and drift between the UI and the release contract.

## Case-detail release-evidence tradeoff

The next UI step reuses that same release-record export on the case-detail page instead of creating a separate case-only release summary. That keeps the current focus case, rollback drill evidence, and parity verdict attached to one exported artifact while making it explicit whether the viewed case is the release anchor or comparison evidence from the same queue.

## Terraform sandbox tradeoff

The first Terraform slice uses only validated inputs, computed locals, outputs, and `terraform_data` state instead of a provider-backed Docker or cloud target. That is intentionally conservative: this host cannot currently validate Terraform CLI plus a real runtime target, and the product still has no truthful managed-environment story. Capturing the reviewed runtime contract in Terraform now is still useful because it proves variable validation, deployment-shape thinking, and operator handoff without inventing infrastructure behavior that the repository cannot yet test.

## Host-readiness artifact tradeoff

The next sandbox-facing slice exports current host prerequisite status through the same API-backed evidence path instead of relying on an undocumented local checklist. That keeps Docker, Compose, Terraform, and live-provider gaps reviewable from the product itself and makes it explicit why a provider-backed sandbox attempt is blocked on a given machine. The tradeoff is that this slice reports current host readiness only; it does not replace a real provider-backed runtime check or claim a successful managed deployment path.

## Release-record host-readiness tradeoff

The next reviewability step embeds that existing host-readiness artifact inside the release record instead of introducing a second release-only host checklist or refetching a separate summary in every UI surface. That keeps runtime parity, rollback context, and provider-backed sandbox blockers attached to one exported contract while preserving the honest boundary: the artifact still reports current host prerequisites only and does not claim a successful provider-backed environment check.

## CI host-readiness bundle tradeoff

The next evidence step captures the live host-readiness export into the same GitHub Actions artifact that already stores runtime parity and release-record evidence instead of asking remote reviewers to fetch a second export or infer host blockers from parity status alone. That keeps release review download-only and consistent with the existing artifact path, while preserving the honest boundary: the host snapshot is still just a point-in-time prerequisite report from the checked machine, not proof that a provider-backed sandbox was exercised successfully.

## CI host-readiness status tradeoff

The next reviewability step stores host-readiness capture status on the same persisted parity artifact instead of inferring success from filenames or introducing a separate CI-status endpoint. That keeps the release record and reviewer workspace aligned on one evidence contract and makes it explicit whether the latest CI bundle actually carried the blocker snapshot. The tradeoff is that reviewers still need to download the artifact for raw JSON details, but they no longer have to guess whether host-readiness capture succeeded at all.

## Failed-ingestion replay tradeoff

The next recovery step reuses the original intake/provider boundary from the case-detail page instead of inventing a second repair API with its own payload or persistence rules. The service owns the stored idempotency key, updates the original failed case in place, and writes explicit replay-request plus recovery-vs-repeat audit events so the retry path stays explainable from the same SQL-backed history. The tradeoff is that replay remains intentionally bounded to cases that already captured an idempotency key; the product still does not claim autonomous repair loops or background retries.

## Replay-evidence release tradeoff

The next release-evidence step reuses the existing seeded smoke path and release-record export instead of documenting replay behavior only in the case page. The smoke harness now executes the replay endpoint and the release record prioritizes replay-recovered or replay-failed focus cases when they exist, so rollback drills point to the strongest current recovery signal automatically. The tradeoff is that the release record now depends on case-detail evidence loading for richer replay context, but that keeps the exported artifact honest to the same persisted audit history the UI already uses.
