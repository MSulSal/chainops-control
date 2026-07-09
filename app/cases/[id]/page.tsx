import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  fetchCaseDetail,
  fetchLatestReleaseRecord,
  getCaseSnapshotUrl,
  getLatestReleaseRecordUrl,
  getOpenTelemetryExportUrl,
  getTelemetryHandoffUrl,
  replayFailedCase,
  submitCaseDecision
} from "../../../src/reviewer-data";
import {
  getCaseReleaseRecordSummary,
  getCaseOperationalGuide,
  getCaseStageTrace,
  formatTimestamp,
  getCaseDetailCallout,
  getProviderSummary,
  getReviewArtifactFocusCaseArtifactHint,
  getReviewArtifactReplayCaptureSummary,
  getStatusCopy
} from "../../../src/reviewer-view.ts";
import { CaseActionSubmitButton, ReviewSubmitButton } from "./review-submit";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;

export default async function CaseDetailPage({
  params,
  searchParams
}: {
  params: Params;
  searchParams?: SearchParams;
}) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const detail = await fetchCaseDetail(id);

  if (!detail) {
    notFound();
  }

  const status = getStatusCopy(detail.caseRecord.status);
  const callout = getCaseDetailCallout(detail.caseRecord, detail.auditEvents);
  const stageTrace = getCaseStageTrace(detail.caseRecord, detail.auditEvents);
  const operationalGuide = getCaseOperationalGuide(detail.caseRecord, detail.auditEvents);
  const caseSnapshotUrl = getCaseSnapshotUrl(detail.caseRecord.id);
  const releaseRecordUrl = getLatestReleaseRecordUrl();
  const telemetryHandoffUrl = getTelemetryHandoffUrl();
  const openTelemetryExportUrl = getOpenTelemetryExportUrl();
  const releaseRecord = await fetchLatestReleaseRecord().catch(() => null);
  const releaseRecordSummary = releaseRecord ? getCaseReleaseRecordSummary(detail.caseRecord, releaseRecord) : null;
  const releaseRecordHostReadiness = releaseRecord?.verification.hostReadiness.lastResult ?? null;
  const releaseRecordRuntimeParity = releaseRecord?.verification.runtimeParity.lastResult ?? null;
  const releaseRecordReviewArtifact = releaseRecord?.verification.runtimeParity.reviewArtifact ?? null;
  const releaseRecordFocusCaseReplayArtifact = releaseRecord?.verification.runtimeParity.focusCaseReplayArtifact ?? null;
  const flash = readStringParam(resolvedSearchParams.flash);
  const error = readStringParam(resolvedSearchParams.error);

  async function reviewCase(formData: FormData) {
    "use server";

    try {
      const decision = formData.get("decision");
      const note = formData.get("note");
      const reviewed = await submitCaseDecision(id, {
        decision: decision === "reject" ? "reject" : "approve",
        note: typeof note === "string" ? note : ""
      });

      revalidatePath("/");
      revalidatePath(`/cases/${id}`);
      redirect(`/cases/${id}?flash=${reviewed.caseRecord.status}`);
    } catch (reviewError) {
      const message = encodeURIComponent((reviewError as Error).message);
      redirect(`/cases/${id}?error=${message}`);
    }
  }

  async function replayCase() {
    "use server";

    try {
      const replayed = await replayFailedCase(id);

      revalidatePath("/");
      revalidatePath(`/cases/${id}`);
      redirect(`/cases/${id}?flash=${replayed.recovered ? "recovered" : "replay_failed"}`);
    } catch (replayError) {
      const message = encodeURIComponent((replayError as Error).message);
      redirect(`/cases/${id}?error=${message}`);
    }
  }

  return (
    <main className="shell">
      <Link href="/" className="back-link">
        Back to reviewer workspace
      </Link>

      <section className="panel">
        <div className="panel-stack">
          <div className="chip-row">
            <span className={`chip chip-${status.tone}`}>{status.label}</span>
            <span className="chip chip-neutral">{detail.caseRecord.risk.level} risk</span>
          </div>

          <div>
            <p className="eyebrow">Case detail</p>
            <h1 className="mono">{detail.caseRecord.walletAddress}</h1>
            <p className="muted">{status.description}</p>
          </div>

          {flash === "approved" ? (
            <div className="callout callout-success">Reviewer decision saved. The case is now approved.</div>
          ) : null}
          {flash === "rejected" ? (
            <div className="callout callout-danger">Reviewer decision saved. The case is now rejected.</div>
          ) : null}
          {flash === "recovered" ? (
            <div className="callout callout-success">
              Replay recovered the original failed case with the stored idempotency key. Review the refreshed evidence and record the human decision.
            </div>
          ) : null}
          {flash === "replay_failed" ? (
            <div className="callout callout-danger">
              Replay reused the original idempotency key, but the provider failed again. Compare the refreshed trace and runtime state before trying again.
            </div>
          ) : null}
          {error ? <div className="callout callout-danger">{error}</div> : null}
          {callout ? <div className="callout callout-danger">{callout}</div> : null}

          <div className="detail-grid">
            <div className="panel">
              <div className="panel-stack">
                <div>
                  <p className="eyebrow">Risk indicators</p>
                  <h2>Deterministic evidence</h2>
                </div>
                <div className="facts-grid">
                  <div className="fact">
                    <strong>Score</strong>
                    <span>{detail.caseRecord.risk.score}</span>
                  </div>
                  {detail.caseRecord.risk.indicators.map((indicator) => (
                    <div key={indicator} className="fact">
                      <strong>Indicator</strong>
                      <span className="muted">{indicator}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-stack">
                <div>
                  <p className="eyebrow">Case metadata</p>
                  <h2>Provider and trace context</h2>
                </div>
                <div className="facts-grid">
                  <div className="fact">
                    <strong>Provider summary</strong>
                    <span className="muted">{getProviderSummary(detail.caseRecord.sourceMetadata)}</span>
                  </div>
                  <div className="fact">
                    <strong>Created</strong>
                    <span className="muted">{formatTimestamp(detail.caseRecord.createdAt)}</span>
                  </div>
                  <div className="fact">
                    <strong>Reviewed</strong>
                    <span className="muted">{formatTimestamp(detail.caseRecord.reviewedAt)}</span>
                  </div>
                  <div className="fact">
                    <strong>Reviewer note</strong>
                    <span className="muted">{detail.caseRecord.reviewerNote ?? "Not recorded yet"}</span>
                  </div>
                  <div className="fact">
                    <strong>Trace ID</strong>
                    <span className="mono">{detail.caseRecord.traceId}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {detail.caseRecord.status === "pending_review" ? (
        <section className="panel" style={{ marginTop: 24 }}>
          <div className="panel-stack">
            <div>
              <p className="eyebrow">Reviewer action</p>
              <h2>Record the human decision</h2>
              <p className="muted">
                A reviewer note is required so approval and rejection remain traceable in the audit history.
              </p>
            </div>
            <form action={reviewCase} className="review-form">
              <label>
                <span className="eyebrow">Decision note</span>
                <textarea
                  name="note"
                  rows={5}
                  maxLength={500}
                  placeholder="Summarize the evidence, caveat, or reason for this reviewer decision."
                  required
                />
              </label>
              <div className="filter-actions">
                <ReviewSubmitButton decision="approve" />
                <ReviewSubmitButton decision="reject" />
              </div>
            </form>
          </div>
        </section>
      ) : null}

      {detail.caseRecord.status === "ingestion_failed" ? (
        <section className="panel" style={{ marginTop: 24 }}>
          <div className="panel-stack">
            <div>
              <p className="eyebrow">Replay action</p>
              <h2>Retry the failed intake path safely</h2>
              <p className="muted">
                This action reuses the original idempotency key through the same intake boundary, updates the original case instead of duplicating state, and records replay outcome evidence in the audit log.
              </p>
            </div>
            <form action={replayCase}>
              <div className="filter-actions">
                <CaseActionSubmitButton
                  label="Replay failed ingestion"
                  pendingLabel="Replaying failed ingestion..."
                  className="button-primary"
                />
              </div>
            </form>
          </div>
        </section>
      ) : null}

      <section className="detail-grid" style={{ marginTop: 24 }}>
        <div className="panel">
          <div className="panel-stack">
            <div>
              <p className="eyebrow">Stage trace</p>
              <h2>Request-stage operational view</h2>
            </div>
            <div className="analytics-grid">
              {stageTrace.map((stage) => (
                <article key={stage.key} className="metric-card">
                  <div className="chip-row">
                    <span className={`chip chip-${stage.tone}`}>{stage.label}</span>
                    <span className="chip chip-neutral">{stage.statusLabel}</span>
                  </div>
                  <h3>{stage.duration}</h3>
                  <p className="muted">{stage.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-stack">
            <div>
              <p className="eyebrow">Release evidence</p>
              <h2>{releaseRecordSummary?.title ?? "Latest release record context"}</h2>
              <p className="muted">
                {releaseRecordSummary?.summary ??
                  "The case page can still export its own evidence even if the latest release record preview is temporarily unavailable."}
              </p>
            </div>
            <div className="chip-row">
              <span className={`chip chip-${releaseRecordSummary?.tone ?? "neutral"}`}>
                {releaseRecord?.release.statusLabel ?? "Record unavailable"}
              </span>
              <span className="chip chip-neutral">
                {releaseRecord ? `${releaseRecord.release.version} on ${releaseRecord.release.channel}` : "queue-level release export"}
              </span>
            </div>
            <div className="filter-actions">
              <a href={releaseRecordUrl}>Export latest release record</a>
              <a href={telemetryHandoffUrl}>Export telemetry handoff</a>
              <a href={openTelemetryExportUrl}>Export OpenTelemetry seam</a>
            </div>
            <div className="facts-grid">
              <div className="fact">
                <strong>Focus-case relation</strong>
                <span className="muted">
                  {releaseRecordSummary?.focusCaseLabel ?? "Latest focus-case context is unavailable."}
                </span>
              </div>
              <div className="fact">
                <strong>Focus trace</strong>
                <span className="mono">{releaseRecord?.evidence.focusTraceId ?? "Not recorded"}</span>
              </div>
              <div className="fact">
                <strong>Rollback decision</strong>
                <span className="muted">{releaseRecord?.rollback.decision ?? "Release record unavailable."}</span>
              </div>
              <div className="fact">
                <strong>Last parity check</strong>
                <span className="muted">
                  {releaseRecordRuntimeParity
                    ? `${releaseRecordRuntimeParity.status.toUpperCase()} at ${formatTimestamp(releaseRecordRuntimeParity.checkedAt)}`
                    : "No persisted runtime parity result is attached to the latest release record."}
                </span>
              </div>
              <div className="fact">
                <strong>Host readiness</strong>
                <span className="muted">
                  {releaseRecordHostReadiness
                    ? `${releaseRecordHostReadiness.overall.statusLabel}: ${releaseRecordHostReadiness.providerSandbox.summary}`
                    : "No host-readiness artifact is attached to the latest release record."}
                </span>
              </div>
              <div className="fact">
                <strong>CI replay evidence</strong>
                <span className="muted">
                  {releaseRecordFocusCaseReplayArtifact?.summary ??
                    getReviewArtifactReplayCaptureSummary(releaseRecordReviewArtifact)}
                </span>
              </div>
            </div>
            {releaseRecord ? (
              <div className="detail-grid detail-grid-balanced">
                <article className="metric-card">
                  <p className="eyebrow">Rollback drill context</p>
                  <ul className="response-list">
                    {releaseRecord.rollback.evidence.map((evidence) => (
                      <li key={evidence}>{evidence}</li>
                    ))}
                  </ul>
                </article>
                <article className="metric-card">
                  <p className="eyebrow">Focus-case and host links</p>
                  <ul className="response-list">
                    <li>
                      {releaseRecordSummary?.focusCasePath ? (
                        <Link href={releaseRecordSummary.focusCasePath}>Open focus case detail</Link>
                      ) : (
                        "No focus case path is attached to the latest release record."
                      )}
                    </li>
                    <li>
                      {releaseRecordSummary?.focusCaseExportPath ? (
                        <a href={releaseRecordSummary.focusCaseExportPath}>Export focus case snapshot</a>
                      ) : (
                        "No focus case export is attached to the latest release record."
                      )}
                    </li>
                    <li>
                      <a href={caseSnapshotUrl}>Export this case snapshot</a>
                    </li>
                    <li>
                      <a href={releaseRecord.verification.hostReadiness.artifactPath}>Export host-readiness artifact</a>
                    </li>
                    <li>{releaseRecordFocusCaseReplayArtifact?.artifactHint ?? getReviewArtifactFocusCaseArtifactHint(releaseRecordReviewArtifact)}</li>
                  </ul>
                </article>
              </div>
            ) : null}
            {releaseRecord?.evidence.replay.history.length ? (
              <article className="metric-card">
                <p className="eyebrow">Replay outcome comparison</p>
                <ul className="response-list">
                  {releaseRecord.evidence.replay.history.map((event) => (
                    <li key={`${event.at}-${event.attempt}`}>
                      {`Attempt ${event.attempt} ${event.status === "failed_again" ? "failed again" : "recovered"} at ${formatTimestamp(event.at)} via ${event.traceId}. ${event.summary}`}
                    </li>
                  ))}
                </ul>
              </article>
            ) : null}
            {releaseRecordHostReadiness?.providerSandbox.missingRequirements.length ? (
              <div className="callout callout-info">
                <strong>{`Provider-backed host status: ${releaseRecordHostReadiness.overall.statusLabel}.`}</strong>{" "}
                {releaseRecordHostReadiness.providerSandbox.missingRequirements.join(" ")}
              </div>
            ) : null}
          </div>
        </div>

        <div className="panel">
          <div className="panel-stack">
            <div>
              <p className="eyebrow">Incident guide</p>
              <h2>{operationalGuide.title}</h2>
              <p className="muted">{operationalGuide.summary}</p>
            </div>
            <div className="chip-row">
              <span className={`chip chip-${operationalGuide.tone}`}>{operationalGuide.statusLabel}</span>
              <span className="chip chip-neutral">trace-backed response</span>
            </div>
            <div className="filter-actions">
              <a href={caseSnapshotUrl}>Export case snapshot</a>
            </div>
            <div className="facts-grid">
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
                <p className="eyebrow">Operator actions</p>
                <ul className="response-list">
                  {operationalGuide.actions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </article>
              <article className="metric-card">
                <p className="eyebrow">Case evidence</p>
                <ul className="response-list">
                  {operationalGuide.evidence.map((evidence) => (
                    <li key={evidence}>{evidence}</li>
                  ))}
                </ul>
              </article>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-stack">
            <div>
              <p className="eyebrow">Transaction sample</p>
              <h2>Bounded public evidence</h2>
            </div>
            <div className="transaction-grid">
              {detail.caseRecord.transactions.length ? (
                detail.caseRecord.transactions.map((transaction) => (
                  <div key={transaction.hash} className="transaction-item">
                    <div className="chip-row">
                      <span className="chip chip-neutral">{transaction.direction}</span>
                      <span className="chip chip-neutral">{transaction.amountEth} ETH</span>
                      <span className="chip chip-neutral">{transaction.confirmations} confirmations</span>
                    </div>
                    <p className="mono">{transaction.hash}</p>
                    <p className="muted mono">{transaction.counterparty}</p>
                  </div>
                ))
              ) : (
                <div className="callout callout-info">
                  No transaction sample is available yet because the most recent provider fetch did not complete.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-stack">
            <div>
              <p className="eyebrow">Audit timeline</p>
              <h2>Traceable workflow history</h2>
            </div>
            <div className="audit-grid">
              {detail.auditEvents.map((event) => (
                <div key={event.id} className="audit-item">
                  <div className="chip-row">
                    <span className="chip chip-neutral">{event.type}</span>
                    <span className="chip chip-neutral">{formatTimestamp(event.at)}</span>
                  </div>
                  <p className="mono">{event.traceId}</p>
                  <p className="muted">{JSON.stringify(event.details)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function readStringParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0]?.trim() || undefined;
  }

  return value?.trim() || undefined;
}
