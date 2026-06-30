import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchCaseDetail } from "../../../src/reviewer-data";
import {
  formatTimestamp,
  getCaseDetailCallout,
  getProviderSummary,
  getStatusCopy
} from "../../../src/reviewer-view.ts";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function CaseDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const detail = await fetchCaseDetail(id);

  if (!detail) {
    notFound();
  }

  const status = getStatusCopy(detail.caseRecord.status);
  const callout = getCaseDetailCallout(detail.caseRecord, detail.auditEvents);

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
                    <strong>Trace ID</strong>
                    <span className="mono">{detail.caseRecord.traceId}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

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
