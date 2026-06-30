import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { fetchCaseDetail, submitCaseDecision } from "../../../src/reviewer-data";
import {
  formatTimestamp,
  getCaseDetailCallout,
  getProviderSummary,
  getStatusCopy
} from "../../../src/reviewer-view.ts";
import { ReviewSubmitButton } from "./review-submit";

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

      <section className="detail-grid" style={{ marginTop: 24 }}>
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
