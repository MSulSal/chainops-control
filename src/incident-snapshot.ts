import type {
  AuditEvent,
  CaseListFilters,
  CaseQueueAnalytics,
  CaseQueueSummary,
  CaseRecord,
  CaseSummary
} from "./domain.ts";
import {
  getCaseOperationalGuide,
  getCaseStageTrace,
  getCaseListSubtitle,
  getProviderSummary,
  getWorkspaceOperationalGuide
} from "./reviewer-view.ts";

export type WorkspaceIncidentSnapshot = {
  generatedAt: string;
  scope: "workspace";
  filters: CaseListFilters;
  releaseGuide: ReturnType<typeof getWorkspaceOperationalGuide>;
  summary: CaseQueueSummary;
  analytics: CaseQueueAnalytics;
  visibleCases: Array<{
    id: string;
    walletAddress: string;
    status: CaseSummary["status"];
    riskLevel: CaseSummary["risk"]["level"];
    riskScore: number;
    providerSummary: string;
    traceId: string;
    createdAt: string;
    summary: string;
  }>;
};

export type CaseIncidentSnapshot = {
  generatedAt: string;
  scope: "case";
  caseRecord: CaseRecord;
  providerSummary: string;
  stageTrace: ReturnType<typeof getCaseStageTrace>;
  incidentGuide: ReturnType<typeof getCaseOperationalGuide>;
  auditEvents: AuditEvent[];
};

export function buildWorkspaceIncidentSnapshot(input: {
  generatedAt?: string;
  filters: CaseListFilters;
  summary: CaseQueueSummary;
  analytics: CaseQueueAnalytics;
  cases: CaseSummary[];
}): WorkspaceIncidentSnapshot {
  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    scope: "workspace",
    filters: input.filters,
    releaseGuide: getWorkspaceOperationalGuide(input.summary, input.analytics),
    summary: input.summary,
    analytics: input.analytics,
    visibleCases: input.cases.map((caseItem) => ({
      id: caseItem.id,
      walletAddress: caseItem.walletAddress,
      status: caseItem.status,
      riskLevel: caseItem.risk.level,
      riskScore: caseItem.risk.score,
      providerSummary: getProviderSummary(caseItem.sourceMetadata),
      traceId: caseItem.traceId,
      createdAt: caseItem.createdAt,
      summary: getCaseListSubtitle(caseItem)
    }))
  };
}

export function buildCaseIncidentSnapshot(input: {
  generatedAt?: string;
  caseRecord: CaseRecord;
  auditEvents: AuditEvent[];
}): CaseIncidentSnapshot {
  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    scope: "case",
    caseRecord: input.caseRecord,
    providerSummary: getProviderSummary(input.caseRecord.sourceMetadata),
    stageTrace: getCaseStageTrace(input.caseRecord, input.auditEvents),
    incidentGuide: getCaseOperationalGuide(input.caseRecord, input.auditEvents),
    auditEvents: input.auditEvents
  };
}
