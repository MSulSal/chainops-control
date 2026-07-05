import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { CaseStatus, RiskLevel } from "../src/domain.ts";
import {
  fetchCaseSummaries,
  fetchLatestRuntimeParityResult,
  getLatestReleaseRecordUrl,
  getLatestRuntimeParityUrl,
  getOpenTelemetryExportUrl,
  getTelemetryHandoffUrl,
  getWorkspaceSnapshotUrl,
  resetDemoScenario,
  type ReviewerWorkspaceFilters
} from "../src/reviewer-data";
import {
  formatTimestamp,
  getActiveFilterChips,
  getWorkspaceOperationalGuide,
  getOperationalMetricCards,
  getQueueAnalyticsCards,
  getCaseListSubtitle,
  getProviderSummary,
  getReviewLatencyCards,
  getTimelineBars,
  getQueueSummaryCards,
  getStatusCopy
} from "../src/reviewer-view.ts";

export const dynamic = "force-dynamic";

type PageSearchParams = Record<string, string | string[] | undefined>;

export default async function ReviewerWorkspacePage({
  searchParams
}: {
  searchParams?: Promise<PageSearchParams> | PageSearchParams;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const initialFilters = readWorkspaceFilters(resolvedSearchParams);
  const { cases, summary, analytics, filters } = await fetchCaseSummaries(initialFilters);
  const activeFilterChips = getActiveFilterChips(filters);
  const summaryCards = getQueueSummaryCards(summary);
  const analyticsCards = getQueueAnalyticsCards(analytics);
  const latencyCards = getReviewLatencyCards(analytics);
  const operationalCards = getOperationalMetricCards(analytics);
  const operationalGuide = getWorkspaceOperationalGuide(summary, analytics);
  const timelineBars = getTimelineBars(analytics.timeline);
  const workspaceSnapshotUrl = getWorkspaceSnapshotUrl(initialFilters);
  const telemetryHandoffUrl = getTelemetryHandoffUrl(initialFilters);
  const openTelemetryExportUrl = getOpenTelemetryExportUrl(initialFilters);
  const releaseRecordUrl = getLatestReleaseRecordUrl(initialFilters);
  const runtimeParityUrl = getLatestRuntimeParityUrl();
  const runtimeParityResult = await fetchLatestRuntimeParityResult().catch(() => null);
  const runtimeParityCiEvidence = runtimeParityResult?.ciEvidence ?? null;
  const flash = readStringParam(resolvedSearchParams.flash);
  const error = readStringParam(resolvedSearchParams.error);

  async function resetWorkspaceDemo() {
    "use server";

    try {
      await resetDemoScenario();
      revalidatePath("/");
      redirect("/?flash=demo-reset");
    } catch (resetError) {
      const message = encodeURIComponent((resetError as Error).message);
      redirect(`/?error=${message}`);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-grid">
          <div>
            <p className="eyebrow">ChainOps Control</p>
            <h1>Reviewer workspace for wallet case operations.</h1>
            <p>
              Read-only Next.js visibility over the live case API: recent intake, provider status, risk posture,
              audit traces, and explicit failed-ingestion handling.
            </p>
          </div>
          <div className="panel">
            <div className="panel-stack">
              <div>
                <p className="eyebrow">Workspace scope</p>
                <h2>What this slice proves</h2>
              </div>
              <div className="facts-grid">
                <div className="fact">
                  <strong>Queue visibility</strong>
                  <span className="muted">Status counts and filters stay API-backed instead of becoming UI-only state.</span>
                </div>
                <div className="fact">
                  <strong>Failure visibility</strong>
                  <span className="muted">Ingestion failures remain queryable with retry-safe context and trace IDs.</span>
                </div>
                <div className="fact">
                  <strong>Operational evidence</strong>
                  <span className="muted">Reviewer summaries show backlog pressure before a human opens a case detail.</span>
                </div>
                <div className="fact">
                  <strong>Repeatable demo reset</strong>
                  <span className="muted">A seeded local dataset can be restored so exports and incident drills can be rerun without manual database cleanup.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {flash === "demo-reset" ? (
        <div className="callout callout-success" style={{ marginBottom: 24 }}>
          Demo dataset reset. Compare the workspace export plus the `trace-demo-provider-timeout` and
          `trace-demo-approved-low` case snapshots; only the export timestamp and pending-review age should move between resets.
        </div>
      ) : null}
      {error ? (
        <div className="callout callout-danger" style={{ marginBottom: 24 }}>
          {error}
        </div>
      ) : null}

      <section className="summary-grid">
        {summaryCards.map((card) => (
          <article key={card.label} className="panel summary-card">
            <p className="eyebrow">{card.label}</p>
            <h2>{card.value}</h2>
            <span className={`chip chip-${card.tone}`}>{card.label}</span>
          </article>
        ))}
      </section>

      <section className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-stack">
          <div>
            <p className="eyebrow">Demo reset</p>
            <h2>Restore the seeded incident review scenario</h2>
            <p className="muted">
              This resets the local case ledger to a stable mix of failed-ingestion, pending-review, approved, and rejected cases so smoke tests and interview walkthroughs start from the same operational story.
            </p>
          </div>
          <div className="facts-grid">
            <div className="fact">
              <strong>Seeded traces</strong>
              <span className="mono">trace-demo-provider-timeout, trace-demo-pending-high, trace-demo-approved-low</span>
            </div>
            <div className="fact">
              <strong>Compare after reset</strong>
              <span className="muted">Case IDs, trace IDs, notes, statuses, and stage durations should remain stable across reruns.</span>
            </div>
          </div>
          <form action={resetWorkspaceDemo} className="filter-actions">
            <button type="submit">Reset demo dataset</button>
            <a href={workspaceSnapshotUrl}>Export workspace snapshot</a>
            <a href={telemetryHandoffUrl}>Export telemetry handoff</a>
            <a href={openTelemetryExportUrl}>Export OpenTelemetry seam</a>
            <a href={releaseRecordUrl}>Export latest release record</a>
          </form>
        </div>
      </section>

      <section className="detail-grid" style={{ marginBottom: 24 }}>
        <article className="panel">
          <div className="panel-stack">
            <div>
              <p className="eyebrow">Workflow analytics</p>
              <h2>Persisted review transitions</h2>
              <p className="muted">
                These counts come from SQL-backed case and audit state, not browser-only transforms.
              </p>
            </div>
            <div className="analytics-grid">
              {analyticsCards.map((card) => (
                <article key={card.label} className="metric-card">
                  <div className="chip-row">
                    <span className={`chip chip-${card.tone}`}>{card.label}</span>
                  </div>
                  <h3>{card.value}</h3>
                  <p className="muted">{card.description}</p>
                </article>
              ))}
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-stack">
            <div>
              <p className="eyebrow">Review latency</p>
              <h2>Queue pressure at a glance</h2>
              <p className="muted">
                Review timing stays visible so the workspace can prove operational history, not only case state.
              </p>
            </div>
            <div className="analytics-grid">
              {latencyCards.map((card) => (
                <article key={card.label} className="metric-card">
                  <div className="chip-row">
                    <span className={`chip chip-${card.tone}`}>{card.label}</span>
                  </div>
                  <h3>{card.value}</h3>
                  <p className="muted">{card.description}</p>
                </article>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-stack">
          <div>
            <p className="eyebrow">Release record</p>
            <h2>Versioned container release evidence</h2>
            <p className="muted">
              Export one bounded JSON artifact that ties the current queue guidance to runtime smoke, telemetry handoff, and rollback evidence before any broader rollout claim.
            </p>
          </div>
          <div className="facts-grid">
            <div className="fact">
              <strong>Version source</strong>
              <span className="muted">Current `package.json` version plus the local container runtime channel.</span>
            </div>
            <div className="fact">
              <strong>Verification contract</strong>
              <span className="mono">npm test | npm run smoke:demo | npm run smoke:runtime | npm run build:web</span>
            </div>
            <div className="fact">
              <strong>Last parity check</strong>
              <span className="muted">
                {runtimeParityResult
                  ? `${runtimeParityResult.status.toUpperCase()} at ${formatTimestamp(runtimeParityResult.checkedAt)} against ${runtimeParityResult.baseUrl}`
                  : "No persisted runtime parity result yet. Run npm run smoke:runtime to capture one."}
              </span>
            </div>
            <div className="fact">
              <strong>CI review path</strong>
              <span className="muted">
                {runtimeParityCiEvidence
                  ? `${runtimeParityCiEvidence.artifactName} from the matching GitHub Actions run carries the raw parity JSON, release record JSON, and capture summary.`
                  : "No GitHub Actions review artifact is attached to the latest parity result."}
              </span>
            </div>
          </div>
          {runtimeParityResult ? (
            <div className={`callout ${runtimeParityResult.status === "failed" ? "callout-danger" : "callout-success"}`}>
              <strong>{runtimeParityResult.status === "failed" ? "Stale runtime signal." : "Runtime parity passed."}</strong>{" "}
              {runtimeParityResult.summary}
              {runtimeParityResult.error ? ` Latest failure: ${runtimeParityResult.error}` : ""}
            </div>
          ) : (
            <div className="callout callout-info">
              No runtime parity artifact is stored yet. The release record will stay incomplete until `npm run smoke:runtime` writes one.
            </div>
          )}
          {runtimeParityResult ? (
            <div className="facts-grid">
              {runtimeParityResult.exportChecks.map((check) => (
                <div key={check.path} className="fact">
                  <strong>{check.path}</strong>
                  <span className="muted">{`${check.status}: ${check.detail}`}</span>
                </div>
              ))}
              {runtimeParityCiEvidence ? (
                <>
                  <div className="fact">
                    <strong>Artifact bundle</strong>
                    <span className="mono">
                      {runtimeParityCiEvidence.artifactName}: {runtimeParityCiEvidence.artifactFiles.join(", ")}
                    </span>
                  </div>
                  <div className="fact">
                    <strong>Review hint</strong>
                    <span className="muted">{runtimeParityCiEvidence.reviewHint}</span>
                  </div>
                  <div className="fact">
                    <strong>GitHub Actions run</strong>
                    <span className="muted">
                      {runtimeParityCiEvidence.run.runUrl ? (
                        <a href={runtimeParityCiEvidence.run.runUrl}>Open matching workflow run</a>
                      ) : runtimeParityCiEvidence.run.runId ? (
                        `Run ${runtimeParityCiEvidence.run.runId}`
                      ) : (
                        "Run metadata was not recorded for this parity result."
                      )}
                    </span>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
          <div className="filter-actions">
            <a href={releaseRecordUrl}>Export latest release record</a>
            <a href={telemetryHandoffUrl}>Export telemetry handoff</a>
            <a href={openTelemetryExportUrl}>Export OpenTelemetry seam</a>
            {runtimeParityResult ? <a href={runtimeParityUrl}>Export latest runtime parity</a> : null}
          </div>
        </div>
      </section>

      <section className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-stack">
          <div>
            <p className="eyebrow">Operational metrics</p>
            <h2>Request-stage timing from persisted audit evidence</h2>
            <p className="muted">
              These timings come from the same stored audit events that power case history, so they stay explainable without adding separate telemetry infrastructure.
            </p>
          </div>
          <div className="analytics-grid">
            {operationalCards.map((card) => (
              <article key={card.label} className="metric-card">
                <div className="chip-row">
                  <span className={`chip chip-${card.tone}`}>{card.label}</span>
                </div>
                <h3>{card.value}</h3>
                <p className="muted">{card.description}</p>
              </article>
            ))}
          </div>
          <div className="filter-actions">
            <a href={telemetryHandoffUrl}>Export telemetry handoff</a>
            <a href={openTelemetryExportUrl}>Export OpenTelemetry seam</a>
          </div>
        </div>
      </section>

      <section className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-stack">
          <div>
            <p className="eyebrow">Release response guide</p>
            <h2>{operationalGuide.title}</h2>
            <p className="muted">
              Queue-level release and rollback guidance stays derived from persisted case and audit evidence instead of a separate incident tracker.
            </p>
          </div>
          <div className="chip-row">
            <span className={`chip chip-${operationalGuide.tone}`}>{operationalGuide.statusLabel}</span>
            <span className="chip chip-neutral">summary from current filters</span>
          </div>
          <div className="filter-actions">
            <a href={workspaceSnapshotUrl}>Export workspace snapshot</a>
            <a href={releaseRecordUrl}>Export latest release record</a>
          </div>
          <div className="facts-grid">
            <div className="fact">
              <strong>Summary</strong>
              <span className="muted">{operationalGuide.summary}</span>
            </div>
            <div className="fact">
              <strong>Release decision</strong>
              <span className="muted">{operationalGuide.releaseDecision}</span>
            </div>
            <div className="fact">
              <strong>Rollback trigger</strong>
              <span className="muted">{operationalGuide.rollbackDecision}</span>
            </div>
          </div>
          <div className="detail-grid detail-grid-balanced">
            <article className="metric-card">
              <p className="eyebrow">Next operator actions</p>
              <ul className="response-list">
                {operationalGuide.actions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            </article>
            <article className="metric-card">
              <p className="eyebrow">Evidence behind this call</p>
              <ul className="response-list">
                {operationalGuide.evidence.map((evidence) => (
                  <li key={evidence}>{evidence}</li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-stack">
          <div>
            <p className="eyebrow">Case timeline</p>
            <h2>Recent intake and review flow</h2>
            <p className="muted">
              Daily intake, review completion, approval, rejection, and failed-ingestion counts stay derived from persisted SQL state.
            </p>
          </div>
          {timelineBars.length ? (
            <div className="timeline-grid">
              {timelineBars.map((point) => (
                <article key={point.dayLabel} className="timeline-card">
                  <div className="timeline-header">
                    <strong>{point.dayLabel}</strong>
                    <span className="muted">
                      {point.createdCount} intake / {point.reviewedCount} reviewed
                    </span>
                  </div>
                  <div className="timeline-bar-group">
                    <div className="timeline-track">
                      <div className="timeline-fill timeline-fill-created" style={{ width: point.createdWidth }} />
                    </div>
                    <div className="timeline-track">
                      <div className="timeline-fill timeline-fill-reviewed" style={{ width: point.reviewedWidth }} />
                    </div>
                  </div>
                  <div className="chip-row">
                    <span className="chip chip-neutral">{point.createdCount} created</span>
                    <span className="chip chip-success">{point.approvedCount} approved</span>
                    <span className="chip chip-danger">{point.rejectedCount} rejected</span>
                    <span className="chip chip-warning">{point.failedIngestionCount} failed</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="callout callout-info">
              Timeline metrics appear after at least one case is stored in the current filtered queue.
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-stack">
          <div className="filter-header">
            <div>
              <p className="eyebrow">Reviewer queue</p>
              <h2>{summary.total ? `${summary.total} matching cases` : "No matching cases"}</h2>
              <p className="muted">
                Filter by status, risk, wallet address, or trace ID without bypassing the service boundary.
              </p>
            </div>
            <form className="filter-form">
              <label>
                <span className="eyebrow">Search</span>
                <input type="search" name="q" defaultValue={filters.search ?? ""} placeholder="wallet or trace id" />
              </label>
              <label>
                <span className="eyebrow">Status</span>
                <select name="status" defaultValue={filters.status ?? ""}>
                  <option value="">All statuses</option>
                  <option value="pending_review">Pending review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="ingestion_failed">Ingestion failed</option>
                </select>
              </label>
              <label>
                <span className="eyebrow">Risk</span>
                <select name="risk" defaultValue={filters.riskLevel ?? ""}>
                  <option value="">All risk levels</option>
                  <option value="high">High risk</option>
                  <option value="medium">Medium risk</option>
                  <option value="low">Low risk</option>
                </select>
              </label>
              <label>
                <span className="eyebrow">Limit</span>
                <select name="limit" defaultValue={String(filters.limit)}>
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </label>
              <div className="filter-actions">
                <button type="submit">Apply filters</button>
                <Link href="/">Clear</Link>
              </div>
            </form>
          </div>

          {activeFilterChips.length ? (
            <div className="chip-row">
              {activeFilterChips.map((chip) => (
                <span key={chip} className="chip chip-neutral">
                  {chip}
                </span>
              ))}
            </div>
          ) : null}

          <div className="case-grid">
            {cases.map((caseItem) => {
              const status = getStatusCopy(caseItem.status);

              return (
                <Link key={caseItem.id} href={`/cases/${caseItem.id}`} className="case-card">
                  <div className="chip-row">
                    <span className={`chip chip-${status.tone}`}>{status.label}</span>
                    <span className="chip chip-neutral">{caseItem.risk.level} risk</span>
                  </div>

                  <div>
                    <h2 className="mono">{caseItem.walletAddress}</h2>
                    <p className="muted">{status.description}</p>
                  </div>

                  <div className="facts-grid">
                    <div className="fact">
                      <strong>Provider</strong>
                      <span className="muted">{getProviderSummary(caseItem.sourceMetadata)}</span>
                    </div>
                    <div className="fact">
                      <strong>Trace</strong>
                      <span className="mono">{caseItem.traceId}</span>
                    </div>
                    <div className="fact">
                      <strong>Received</strong>
                      <span className="muted">{formatTimestamp(caseItem.createdAt)}</span>
                    </div>
                    <div className="fact">
                      <strong>Summary</strong>
                      <span className="muted">{getCaseListSubtitle(caseItem)}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}

function readWorkspaceFilters(searchParams: PageSearchParams): ReviewerWorkspaceFilters {
  return {
    limit: readNumberParam(searchParams.limit),
    status: readAllowedValue<CaseStatus>(readStringParam(searchParams.status), [
      "pending_review",
      "approved",
      "rejected",
      "ingestion_failed"
    ]),
    risk: readAllowedValue<RiskLevel>(readStringParam(searchParams.risk), ["low", "medium", "high"]),
    query: readStringParam(searchParams.q)
  };
}

function readStringParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0]?.trim() || undefined;
  }

  return value?.trim() || undefined;
}

function readNumberParam(value: string | string[] | undefined): number | undefined {
  const raw = readStringParam(value);
  if (!raw) {
    return undefined;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readAllowedValue<T extends string>(value: string | undefined, allowed: T[]): T | undefined {
  if (!value || !allowed.includes(value as T)) {
    return undefined;
  }

  return value as T;
}
