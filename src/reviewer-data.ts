import type {
  AuditEvent,
  CaseQueueAnalytics,
  CaseListFilters,
  CaseQueueSummary,
  CaseRecord,
  CaseSummary,
  CaseStatus,
  RiskLevel
} from "./domain.ts";
import type { DemoScenarioName } from "./demo-scenario.ts";

export type CaseDetailResponse = {
  caseRecord: CaseRecord;
  auditEvents: AuditEvent[];
};

export type CaseListResponse = {
  cases: CaseSummary[];
  summary: CaseQueueSummary;
  analytics: CaseQueueAnalytics;
  filters: CaseListFilters;
};

export type ReviewerWorkspaceFilters = {
  limit?: number;
  status?: CaseStatus;
  risk?: RiskLevel;
  query?: string;
};

export type CaseDecisionInput = {
  decision: "approve" | "reject";
  note: string;
};

export type DemoResetResponse = {
  scenario: DemoScenarioName;
  title: string;
  description: string;
  seededCases: Array<{
    id: string;
    label: string;
    status: CaseStatus;
    traceId: string;
  }>;
  workspacePath: string;
  workspaceSnapshotPath: string;
  notes: string[];
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

export async function submitCaseDecision(
  caseId: string,
  input: CaseDecisionInput
): Promise<CaseDetailResponse> {
  const response = await fetch(`${getApiBaseUrl()}/cases/${caseId}/approval`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `failed to review case ${caseId}: ${response.status}`);
  }

  const reviewed = (await response.json()) as { caseRecord: CaseRecord };
  return fetchCaseDetail(reviewed.caseRecord.id).then((detail) => {
    if (!detail) {
      throw new Error(`failed to reload case ${caseId} after review`);
    }

    return detail;
  });
}

export async function resetDemoScenario(): Promise<DemoResetResponse> {
  const response = await fetch(`${getApiBaseUrl()}/demo/reset`, {
    method: "POST",
    cache: "no-store"
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `failed to reset demo scenario: ${response.status}`);
  }

  return (await response.json()) as DemoResetResponse;
}

export function getWorkspaceSnapshotUrl(filters: ReviewerWorkspaceFilters = {}): string {
  const query = buildCaseListQuery(filters);
  return `${getApiBaseUrl()}/exports/workspace${query ? `?${query}` : ""}`;
}

export function getTelemetryHandoffUrl(filters: ReviewerWorkspaceFilters = {}): string {
  const query = buildCaseListQuery(filters);
  return `${getApiBaseUrl()}/exports/telemetry${query ? `?${query}` : ""}`;
}

export function getCaseSnapshotUrl(caseId: string): string {
  return `${getApiBaseUrl()}/exports/cases/${caseId}`;
}

export function getApiBaseUrl(): string {
  return process.env.CHAINOPS_API_BASE_URL?.trim() || "http://127.0.0.1:4317";
}

export function buildCaseListQuery(filters: ReviewerWorkspaceFilters): string {
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
