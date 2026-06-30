import type {
  AuditEvent,
  CaseListFilters,
  CaseQueueSummary,
  CaseRecord,
  CaseSummary,
  CaseStatus,
  RiskLevel
} from "./domain.ts";

export type CaseDetailResponse = {
  caseRecord: CaseRecord;
  auditEvents: AuditEvent[];
};

export type CaseListResponse = {
  cases: CaseSummary[];
  summary: CaseQueueSummary;
  filters: CaseListFilters;
};

export type ReviewerWorkspaceFilters = {
  limit?: number;
  status?: CaseStatus;
  risk?: RiskLevel;
  query?: string;
};

export async function fetchCaseSummaries(filters: ReviewerWorkspaceFilters = {}): Promise<CaseListResponse> {
  const response = await fetch(`${getApiBaseUrl()}/cases?${buildCaseListQuery(filters)}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`failed to load cases: ${response.status}`);
  }

  return (await response.json()) as CaseListResponse;
}

export async function fetchCaseDetail(caseId: string): Promise<CaseDetailResponse | null> {
  const response = await fetch(`${getApiBaseUrl()}/cases/${caseId}`, {
    cache: "no-store"
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`failed to load case ${caseId}: ${response.status}`);
  }

  return (await response.json()) as CaseDetailResponse;
}

function getApiBaseUrl(): string {
  return process.env.CHAINOPS_API_BASE_URL?.trim() || "http://127.0.0.1:4317";
}

function buildCaseListQuery(filters: ReviewerWorkspaceFilters): string {
  const params = new URLSearchParams();

  if (filters.limit) {
    params.set("limit", String(filters.limit));
  }

  if (filters.status) {
    params.set("status", filters.status);
  }

  if (filters.risk) {
    params.set("risk", filters.risk);
  }

  if (filters.query?.trim()) {
    params.set("q", filters.query.trim());
  }

  return params.toString();
}
