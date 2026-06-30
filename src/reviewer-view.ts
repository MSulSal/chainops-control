import type {
  AuditEvent,
  CaseListFilters,
  CaseQueueSummary,
  CaseRecord,
  CaseStatus,
  CaseSummary,
  SourceMetadata
} from "./domain.ts";

type StatusTone = "neutral" | "warning" | "danger" | "success";

export type StatusCopy = {
  label: string;
  tone: StatusTone;
  description: string;
};

export function getStatusCopy(status: CaseStatus): StatusCopy {
  switch (status) {
    case "approved":
      return {
        label: "Approved",
        tone: "success",
        description: "Reviewer completed the case and approved the current evidence."
      };
    case "rejected":
      return {
        label: "Rejected",
        tone: "danger",
        description: "Reviewer completed the case and rejected the current evidence."
      };
    case "ingestion_failed":
      return {
        label: "Ingestion failed",
        tone: "danger",
        description: "Provider data did not load cleanly. Retry with the same idempotency key to recover the case."
      };
    default:
      return {
        label: "Pending review",
        tone: "warning",
        description: "Deterministic indicators are ready, but a human still owns the decision."
      };
  }
}

export function formatTimestamp(value?: string): string {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC"
  }).format(new Date(value));
}

export function getProviderSummary(sourceMetadata?: SourceMetadata): string {
  if (!sourceMetadata) {
    return "Provider metadata unavailable";
  }

  const parts = [
    sourceMetadata.provider,
    sourceMetadata.mode,
    `${sourceMetadata.transactionCount} tx`,
    `attempt ${sourceMetadata.attemptCount}`
  ];

  if (sourceMetadata.errorCode) {
    parts.push(`error ${sourceMetadata.errorCode}`);
  }

  return parts.join(" | ");
}

export function getCaseListSubtitle(caseItem: CaseSummary): string {
  return `${getProviderSummary(caseItem.sourceMetadata)} | trace ${caseItem.traceId}`;
}

export function getCaseDetailCallout(caseRecord: CaseRecord, auditEvents: AuditEvent[]): string | null {
  if (caseRecord.status !== "ingestion_failed") {
    return null;
  }

  const failedEvent = [...auditEvents].reverse().find((event) => event.type === "PROVIDER_FETCH_FAILED");
  const errorCode =
    typeof failedEvent?.details.errorCode === "string" ? failedEvent.details.errorCode : "unknown";
  return `The latest provider fetch ended in ${errorCode}. Retry the intake with the same idempotency key so the original case can recover instead of duplicating state.`;
}

export function getQueueSummaryCards(summary: CaseQueueSummary): Array<{ label: string; value: string; tone: StatusTone }> {
  return [
    { label: "Visible queue", value: String(summary.total), tone: "neutral" },
    { label: "Pending review", value: String(summary.pendingReviewCount), tone: "warning" },
    { label: "Failed ingestion", value: String(summary.failedIngestionCount), tone: "danger" },
    { label: "High risk", value: String(summary.highRiskCount), tone: "success" }
  ];
}

export function getActiveFilterChips(filters: CaseListFilters): string[] {
  const chips: string[] = [];

  if (filters.status) {
    chips.push(`status:${filters.status}`);
  }

  if (filters.riskLevel) {
    chips.push(`risk:${filters.riskLevel}`);
  }

  if (filters.search) {
    chips.push(`query:${filters.search}`);
  }

  return chips;
}
