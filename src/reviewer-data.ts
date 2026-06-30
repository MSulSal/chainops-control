import type { AuditEvent, CaseRecord, CaseSummary } from "./domain.ts";

export type CaseDetailResponse = {
  caseRecord: CaseRecord;
  auditEvents: AuditEvent[];
};

export async function fetchCaseSummaries(limit = 20): Promise<CaseSummary[]> {
  const response = await fetch(`${getApiBaseUrl()}/cases?limit=${limit}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`failed to load cases: ${response.status}`);
  }

  const payload = (await response.json()) as { cases: CaseSummary[] };
  return payload.cases;
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
