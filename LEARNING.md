# Engineering Notes

Use this as the implementation checklist for the product. Keep notes tied to shipped behavior and operational decisions.

## Next.js, React, and TypeScript

- Refresh: Server vs Client Components, Route Handlers, forms, caching, error/loading boundaries, accessible state, TypeScript narrowing and generics.
- Applied in slice 4: server-rendered reviewer workspace, typed API fetch layer, status-driven UI copy, and failed-ingestion visibility without duplicating backend state.
- Applied in slice 5: URL-backed reviewer filters, API-driven summary cards, and typed query parsing for wallet/trace search without coupling the UI directly to PostgreSQL.
- Applied in slice 6: server-action form handling, redirect-safe cache refresh, and required reviewer-note capture over the same API boundary.
- Applied in slice 8: workspace cards for persisted request-stage timings plus case-detail stage traces derived from audit history instead of ad hoc client timers.
- Applied in slice 9: queue-level release guidance and case-level incident/rollback playbooks computed from typed API data so operational response stays explainable inside the existing React boundary.
- Applied in slice 10: export links in the Next.js workspace now hand off bounded JSON artifacts built from the same typed API state the UI renders, which keeps operational evidence shareable without adding a second client-only export model.
- Applied in slice 11: a server-action reset control now restores a deterministic demo dataset through the same API boundary, which is a useful pattern for reproducible smoke tests without inventing a private fixture-only UI.
- Applied in slice 12: a dedicated smoke harness now boots the service, resets the seeded scenario, and asserts stable export evidence over HTTP, which is a useful pattern for proving release readiness without reaching for external test infrastructure too early.
- Applied in slice 16: the same seeded smoke path now also validates a bounded release record artifact, which is a useful reminder that release notes are more trustworthy when they are generated from the same runtime evidence already used for incident and telemetry exports.
- Applied in slice 17: the reviewer workspace now links to a local OpenTelemetry-shaped export seam, which is a useful pattern for surfacing observability evidence without introducing a second client-only model or pretending a collector already exists.
- Applied in slice 18: the live runtime smoke path now compares telemetry, OpenTelemetry, and release-record exports against the current seeded parity contract, which is a useful pattern for catching stale container drift before a release artifact is treated as current.
- Applied in slice 19: the runtime smoke path now persists its latest pass/fail result as a local artifact and the API/UI read that same artifact back, which is a useful pattern for surfacing CI or operator evidence without inventing a second database table for ephemeral release checks.
- Applied in slice 20: GitHub Actions now captures the persisted runtime-parity artifact plus the live release record into one downloadable evidence bundle, which is a useful pattern for handing reviewers raw pass/fail evidence without requiring them to rerun the smoke path locally.
- Applied in slice 21: the cleanest way to tie a stale-runtime signal back to CI was to enrich the existing persisted parity artifact with GitHub Actions metadata instead of inventing a second evidence store or post-run sync step.
- Applied in slice 21: carrying the artifact name, run URL, and expected bundle files inside the release evidence makes failure review faster because the operator can jump straight from the runtime verdict to the exact downloadable CI bundle.
- Applied in slice 22: the cleanest way to make release evidence explainable in the workspace was to fetch and render the existing release-record artifact directly instead of reconstructing a second client-only summary that could drift from the API contract.
- Applied in slice 22: showing verification commands, focus-case links, rollback triggers, and explicit boundaries in the same release panel makes incident-review stories easier to explain because the UI and exported JSON now describe the same operational contract.
- Applied in slice 23: the cleanest way to make case-detail release context honest was to reuse the same exported release record there too, then describe whether the current case is the rollback drill anchor instead of inventing a second case-only release model.
- Applied in slice 23: carrying focus-case links, rollback evidence, and parity status into the case page makes it easier to explain how queue-level release guidance connects back to one concrete trace without leaving the existing API boundary.
- Applied in slice 24: the cleanest way to keep host-tooling blockers honest was to export one API-backed host-readiness artifact and render that in the workspace, instead of maintaining a separate prose checklist that could drift from the current machine state.
- Applied in slice 25: the cleanest way to keep provider-backed blockers attached to release review was to embed the existing host-readiness artifact inside the release record instead of inventing a second release-only checklist or duplicating host-state fetch logic in React.
- Applied in slice 26: the cleanest way to keep remote release review honest was to capture the same host-readiness artifact in the CI bundle instead of forcing reviewers to infer host blockers from parity failures or fetch a second export outside the artifact package.
- Docs: https://nextjs.org/docs | https://react.dev/learn | https://www.typescriptlang.org/docs/

## Node.js and TypeScript service

- Refresh: runtime and event loop, typed request/response contracts, schema validation, error handling, abort/timeouts, queues, idempotency, and integration testing.
- Applied in slice 1: REST API, wallet validation, deterministic ingestion fixture, health/readiness, failure responses, structured logs, trace IDs, and Node integration tests.
- Applied in slice 2: optional `Idempotency-Key` header, replay-safe duplicate intake, transaction-bound SQL writes, and database-backed integration tests.
- Applied in slice 8: bounded request timing captured at the API/store boundary for intake and reviewer decisions, then persisted as audit-event details so operational evidence survives refreshes and replays.
- Applied in slice 9: release and rollback guidance stays as deterministic service/UI logic rather than becoming a manual-only note outside the product.
- Applied in slice 10: dedicated export endpoints package queue filters, case evidence, stage traces, and audit history into review-safe incident snapshots without breaking the existing service boundary.
- Applied in slice 11: the demo-reset endpoint replaces existing SQL rows with a seeded incident story so stable traces and review notes can be regenerated on demand.
- Applied in slice 12: the smoke harness reuses the same service and store contracts in-process, which is a good reminder that CI release evidence should exercise the real API boundary instead of reimplementing assertions around internal helpers.
- Applied in slice 15: a telemetry handoff artifact can stay honest by exporting the existing health/readiness, smoke, trace, and audit-ledger evidence first, then leaving collector plumbing as documented next-step work instead of pretending the stack already exists.
- Applied in slice 16: a release-record endpoint can stay reviewable by packaging existing queue guidance, smoke commands, and rollback evidence instead of inventing a deployment API or external release service.
- Applied in slice 17: a local OpenTelemetry export can stay honest by deriving spans and metrics from the existing audit ledger, then making collector wiring an explicit later concern instead of a hidden assumption.
- Applied in slice 18: runtime parity checks stay reviewable when they normalize only the explicitly documented time-relative fields instead of hiding broad snapshot differences.
- Applied in slice 19: release evidence stays explainable when the smoke script writes a structured artifact with checked export paths, ignored fields, and the exact failure summary instead of leaving parity results trapped in console output.
- Applied in slice 20: CI evidence stays reviewable when the workflow uploads the raw parity artifact, a capture summary, and any reachable release record as one bundle before the compose stack is torn down.
- Docs: https://nodejs.org/docs/latest/api/ | https://www.typescriptlang.org/docs/

## PostgreSQL and SQL

- Refresh: schema constraints, indexes, transactions, upserts, JSONB tradeoffs, migrations, query plans, audit/event tables.
- Applied in slice 2: cases table, normalized transactions table, immutable audit-events table, schema bootstrapping, indexes, and CI-backed PostgreSQL tests.
- Applied in slice 3: JSONB source metadata on cases, persisted provider-failure audit events, and same-case recovery when a previously failed idempotent intake succeeds on retry.
- Applied in slice 5: aggregate queue counts plus status/risk/search filtering from SQL so operational UI state stays backed by the stored case ledger.
- Applied in slice 7: SQL-backed review-transition counts, review-latency aggregation, and timeline bucketing from persisted case timestamps so the workspace can explain queue pressure and operational history.
- Applied in slice 8: filtered audit-event scans that summarize intake, provider-fetch, and reviewer-decision timings without adding a second telemetry store before the product needs one.
- Applied in slice 9: persisted queue counts, latency values, and timing summaries now also drive release readiness, watch-state, and hold-state guidance.
- Applied in slice 10: the same stored queue and case evidence now feeds downloadable incident artifacts, which is a useful pattern for support handoff and debugging exercises.
- Applied in slice 11: a deterministic seed set now proves how to reset relational workflow state safely, preserve foreign-key order, and keep case/audit identifiers stable enough for repeatable comparisons.
- Applied in slice 12: stable seeded identifiers make it possible to compare exported incident artifacts across repeated resets while intentionally ignoring only time-relative fields such as export timestamps and current pending age.
- Applied in slice 15: recent trace samples can be handed off as JSON links plus case-export paths, which is a practical bridge between product evidence and future observability tooling.
- Applied in slice 17: deterministic hex trace and span IDs can be generated from existing workflow identifiers so a local export seam remains stable enough for review and future parity checks without claiming native SDK instrumentation.
- Docs: https://www.postgresql.org/docs/current/

## Ethereum data API

- Refresh: addresses, transactions, blocks, confirmations, JSON-RPC, rate limits, chain/reorg caveats.
- Applied in slice 3: an Etherscan-compatible read-only transaction adapter with bounded history, abort-based timeouts, retry behavior, and deterministic local fallback for tests and offline runs.
- Docs: https://ethereum.org/en/developers/apis/json-rpc/ | https://docs.etherscan.io/

## Docker and Terraform

- Refresh: images/layers, Compose networking, health checks, Terraform state/plan/apply/modules, and environment boundaries.
- Apply: repeatable local stack, container CI, and a minimal disposable infrastructure plan.
- Applied in slice 14: a provider-free Terraform sandbox now validates the current API/PostgreSQL/runtime inputs and emits reviewed operator outputs, which is a useful pattern when infrastructure evidence needs to stay truthful to a still-local container boundary.
- Docs: https://docs.docker.com/get-started/ | https://developer.hashicorp.com/terraform/docs

## Observability and CI/CD

- Refresh: logs vs metrics vs traces, correlation IDs, RED metrics, OpenTelemetry context propagation, CI jobs/artifacts/caches/environments.
- Applied in slice 8: trace wallet intake, provider fetch, and reviewer approval through persisted audit-event durations and reviewer workspace cards.
- Applied in slice 9: release/rollback guidance is now computed from persisted queue and case evidence instead of living only in prose runbooks.
- Applied in slice 11: seeded trace IDs and resettable incident evidence make it easier to rehearse rollback and failure-analysis stories without claiming external telemetry ownership.
- Applied in slice 12: GitHub Actions now runs the seeded smoke harness alongside `npm test` and `npm run build:web`, which turns trace-backed incident evidence into a release gate instead of an informal manual check.
- Applied in slice 13: the runtime smoke script now polls `/health` and `/ready` before reusing the same seeded demo/export assertions against the live Docker Compose API, which is a practical pattern for proving startup ordering and runtime contracts without introducing a broader deployment target yet.
- Applied in slice 14: the Terraform sandbox reuses those same health/readiness, demo-reset, and smoke commands as IaC outputs, which is a good reminder that deployment/runbook evidence should point back to the tested runtime contract instead of diverging into a separate undocumented path.
- Applied in slice 15: the telemetry handoff export reuses the same runtime contract plus persisted timing metrics, which is a useful pattern for observability planning when the honest answer is still "collector not provisioned yet."
- Applied in slice 16: package-version release notes stay bounded when they point back to `npm test`, both smoke commands, and the same trace-backed rollback evidence instead of claiming that a deployment pipeline or hosted release target already exists.
- Applied in slice 17: OpenTelemetry-shaped spans and metrics are more defensible when they point back to persisted audit timestamps and queue analytics than when they duplicate timers or invent a collector on an unvalidated host.
- Applied in slice 18: a stale runtime should fail on missing or drifting exports before it fails in front of a reviewer, which is why the runtime smoke path now checks the telemetry and release artifacts directly.
- Applied in slice 19: a parity gate is easier to operate when its last result is persisted and queryable through the same API/reviewer surface, because release reviewers can see stale-runtime evidence even when they are not the ones who ran the smoke command.
- Applied in slice 20: artifact capture should happen before teardown and with `if: always()` so reviewers still get failure evidence when the runtime-parity gate fails.
- Applied in slice 22: release evidence stays honest when the UI previews the same exported record the API serves, because reviewers can inspect the current operational contract without relying on a separate manually maintained checklist.
- Applied in slice 23: release evidence becomes easier to debug when the case page can say explicitly whether the viewed case is the current release anchor or a comparison case, because rollback drills stay attached to one exported focus path.
- Applied in slice 24: local prerequisite checks are more defensible when Docker, Compose, Terraform, and provider-base-URL status come from one bounded artifact that says exactly what is blocked on this host instead of implying a provider-backed target is already validated.
- Applied in slice 25: release evidence stays easier to debug when runtime-parity status and host-readiness blockers travel in the same exported artifact, because an operator can explain both "what the runtime did" and "why the next sandbox attempt is still paused" without leaving the existing API boundary.
- Applied in slice 26: CI evidence stays easier to hand off when the raw host-readiness snapshot ships beside the runtime-parity and release-record JSON, because a reviewer can compare stale-runtime evidence with Docker/Terraform/provider blockers from the same downloadable bundle.
- Docs: https://opentelemetry.io/docs/languages/ | https://docs.github.com/actions

## Design checks

Be able to explain:

1. Why keep the first service boundary in TypeScript/Node.js instead of adding a new language?
2. How is ingestion idempotent and how are reorgs or provider failures represented?
   Provider failures create `ingestion_failed` state plus immutable audit events; the same idempotency key retries the original case instead of minting a second one.
3. Which decisions are deterministic and which belong to a reviewer?
4. How do schema validation, audit events, and human approval reduce case-review risk?
5. What would change between Docker Compose and a production deployment?
6. Which metric or trace should be inspected first during a failed case run?
7. Why does the reviewer workspace fetch from the API instead of querying PostgreSQL directly?
8. Why keep queue summaries in the API contract instead of computing them only in React?
9. Why keep workflow analytics on `GET /cases` instead of splitting them into a second reporting endpoint this early?
10. Why derive timing metrics from the audit ledger first instead of adding OpenTelemetry infrastructure immediately?
11. Why keep release and rollback guidance as computed product behavior inside the existing API/UI contract instead of introducing a separate incident tool?
12. Why export incident evidence from the same queue and case APIs instead of rebuilding the artifact in the browser?
13. Why reset the seeded demo dataset through the same PostgreSQL tables and API boundary instead of keeping a separate fixture-only demo mode?
14. Why keep the first Terraform slice provider-free instead of forcing a Docker or cloud target that cannot be validated honestly on this host?
15. Why export a local OpenTelemetry-shaped artifact before adding SDK instrumentation or a collector?
16. Why persist the last runtime-parity result as an artifact instead of leaving it only in console logs?
17. Why upload the parity artifact as a CI bundle before tearing down the runtime?
18. Why carry the GitHub Actions run URL and artifact hints on the persisted parity artifact instead of adding a separate release-evidence endpoint or table?
19. Why render the release-record export directly in the workspace instead of rebuilding the same release summary as client-only UI state?
20. Why embed host-readiness inside the release record instead of keeping it only as a separate export?
