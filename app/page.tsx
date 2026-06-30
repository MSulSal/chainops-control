import Link from "next/link";
import { fetchCaseSummaries } from "../src/reviewer-data";
import {
  formatTimestamp,
  getCaseListSubtitle,
  getProviderSummary,
  getStatusCopy
} from "../src/reviewer-view.ts";

export const dynamic = "force-dynamic";

export default async function ReviewerWorkspacePage() {
  const cases = await fetchCaseSummaries();

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
                  <strong>Full-stack handoff</strong>
                  <span className="muted">Next.js reads the existing API instead of duplicating backend state.</span>
                </div>
                <div className="fact">
                  <strong>Failure visibility</strong>
                  <span className="muted">Ingestion failures stay visible with retry-safe context and trace IDs.</span>
                </div>
                <div className="fact">
                  <strong>Operational evidence</strong>
                  <span className="muted">Provider metadata, audit history, and deterministic indicators remain inspectable.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-stack">
          <div>
            <p className="eyebrow">Recent cases</p>
            <h2>{cases.length ? `${cases.length} visible cases` : "No cases yet"}</h2>
            <p className="muted">
              Start the API service, then this workspace, to review provider status, trace IDs, and case outcomes.
            </p>
          </div>

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

