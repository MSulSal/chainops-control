import Link from "next/link";
import type { CaseStatus, RiskLevel } from "../src/domain.ts";
import { fetchCaseSummaries, type ReviewerWorkspaceFilters } from "../src/reviewer-data";
import {
  formatTimestamp,
  getActiveFilterChips,
  getCaseListSubtitle,
  getProviderSummary,
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
  const { cases, summary, filters } = await fetchCaseSummaries(initialFilters);
  const activeFilterChips = getActiveFilterChips(filters);
  const summaryCards = getQueueSummaryCards(summary);

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
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="summary-grid">
        {summaryCards.map((card) => (
          <article key={card.label} className="panel summary-card">
            <p className="eyebrow">{card.label}</p>
            <h2>{card.value}</h2>
            <span className={`chip chip-${card.tone}`}>{card.label}</span>
          </article>
        ))}
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
