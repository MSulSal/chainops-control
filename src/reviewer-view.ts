import type {
  AuditEvent,
  CaseQueueAnalytics,
  CaseListFilters,
  CaseQueueSummary,
  CaseRecord,
  CaseStatus,
  CaseTimelinePoint,
  CaseSummary,
  SourceMetadata
} from "./domain.ts";

type StatusTone = "neutral" | "warning" | "danger" | "success";

type TraceStageTone = Extract<StatusTone, "neutral" | "warning" | "danger" | "success">;

export type StageTraceCard = {
  key: string;
  label: string;
  tone: TraceStageTone;
  statusLabel: string;
  duration: string;
  detail: string;
};

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

export function getQueueAnalyticsCards(
  analytics: CaseQueueAnalytics
): Array<{ label: string; value: string; tone: StatusTone; description: string }> {
  return [
    {
      label: "Entered review",
      value: String(analytics.statusTransitions.enteredReviewCount),
      tone: "warning",
      description: "Cases that reached the human-review step inside the current filtered queue."
    },
    {
      label: "Approved transitions",
      value: String(analytics.statusTransitions.approvedCount),
      tone: "success",
      description: "Persisted approvals recorded through the API and audit log."
    },
    {
      label: "Rejected transitions",
      value: String(analytics.statusTransitions.rejectedCount),
      tone: "danger",
      description: "Rejected cases with reviewer evidence saved to the audit trail."
    },
    {
      label: "Failed ingestions",
      value: String(analytics.statusTransitions.failedIngestionCount),
      tone: "danger",
      description: "Provider failures retained for replay-safe recovery and follow-up."
    }
  ];
}

export function getReviewLatencyCards(
  analytics: CaseQueueAnalytics
): Array<{ label: string; value: string; tone: StatusTone; description: string }> {
  return [
    {
      label: "Reviewed cases",
      value: String(analytics.reviewLatency.reviewedCount),
      tone: "neutral",
      description: "Cases with a persisted reviewer decision in the current filtered queue."
    },
    {
      label: "Average review hours",
      value: formatHours(analytics.reviewLatency.averageHours),
      tone: "warning",
      description: "Mean elapsed time from intake to reviewer decision."
    },
    {
      label: "Slowest review hours",
      value: formatHours(analytics.reviewLatency.maxHours),
      tone: "warning",
      description: "Longest elapsed review time among completed cases."
    },
    {
      label: "Oldest pending hours",
      value: formatHours(analytics.reviewLatency.oldestPendingHours),
      tone: analytics.reviewLatency.oldestPendingHours && analytics.reviewLatency.oldestPendingHours >= 24 ? "danger" : "neutral",
      description: "Maximum waiting time among cases still pending review."
    }
  ];
}

export function getOperationalMetricCards(
  analytics: CaseQueueAnalytics
): Array<{ label: string; value: string; tone: StatusTone; description: string }> {
  return [
    {
      label: "Intake pipeline",
      value: formatMetricDuration(analytics.operationalMetrics.intakePipeline.averageDurationMs),
      tone: analytics.operationalMetrics.intakePipeline.failedCount ? "danger" : "neutral",
      description: describeMetricCounts(
        analytics.operationalMetrics.intakePipeline.completedCount,
        analytics.operationalMetrics.intakePipeline.failedCount,
        analytics.operationalMetrics.intakePipeline.maxDurationMs
      )
    },
    {
      label: "Provider fetch",
      value: formatMetricDuration(analytics.operationalMetrics.providerFetch.averageDurationMs),
      tone: analytics.operationalMetrics.providerFetch.failedCount ? "danger" : "warning",
      description: describeMetricCounts(
        analytics.operationalMetrics.providerFetch.completedCount,
        analytics.operationalMetrics.providerFetch.failedCount,
        analytics.operationalMetrics.providerFetch.maxDurationMs
      )
    },
    {
      label: "Reviewer decision",
      value: formatMetricDuration(analytics.operationalMetrics.reviewerDecision.averageDurationMs),
      tone: analytics.operationalMetrics.reviewerDecision.completedCount ? "success" : "neutral",
      description: describeMetricCounts(
        analytics.operationalMetrics.reviewerDecision.completedCount,
        analytics.operationalMetrics.reviewerDecision.failedCount,
        analytics.operationalMetrics.reviewerDecision.maxDurationMs
      )
    }
  ];
}

export function getTimelineBars(
  timeline: CaseTimelinePoint[]
): Array<{
  dayLabel: string;
  createdCount: number;
  reviewedCount: number;
  approvedCount: number;
  rejectedCount: number;
  failedIngestionCount: number;
  createdWidth: string;
  reviewedWidth: string;
}> {
  const peak = Math.max(
    1,
    ...timeline.map((point) =>
      Math.max(point.createdCount, point.reviewedCount, point.approvedCount + point.rejectedCount + point.failedIngestionCount)
    )
  );

  return timeline.map((point) => ({
    dayLabel: formatDayLabel(point.day),
    createdCount: point.createdCount,
    reviewedCount: point.reviewedCount,
    approvedCount: point.approvedCount,
    rejectedCount: point.rejectedCount,
    failedIngestionCount: point.failedIngestionCount,
    createdWidth: `${Math.max(10, Math.round((point.createdCount / peak) * 100))}%`,
    reviewedWidth: `${Math.max(10, Math.round((point.reviewedCount / peak) * 100))}%`
  }));
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

export function getCaseStageTrace(caseRecord: CaseRecord, auditEvents: AuditEvent[]): StageTraceCard[] {
  const intakePending = findLastAuditEvent(auditEvents, "HUMAN_REVIEW_PENDING");
  const providerFailed = findLastAuditEvent(auditEvents, "PROVIDER_FETCH_FAILED");
  const providerIngested = findLastAuditEvent(auditEvents, "TRANSACTIONS_INGESTED");
  const reviewerDecision =
    findLastAuditEvent(auditEvents, "HUMAN_APPROVED") ?? findLastAuditEvent(auditEvents, "HUMAN_REJECTED");

  return [
    {
      key: "intake",
      label: "Intake pipeline",
      tone: intakePending ? "success" : providerFailed ? "danger" : "warning",
      statusLabel: intakePending ? "Completed" : providerFailed ? "Failed" : "Pending",
      duration: formatMetricDuration(
        readEventDuration(intakePending?.details, "durationMs") ?? readEventDuration(providerFailed?.details, "intakeDurationMs")
      ),
      detail: intakePending
        ? "Wallet validation, bounded ingestion, and risk evaluation completed."
        : providerFailed
          ? "The request stopped before review-ready state because provider ingestion failed."
          : "Waiting for intake events."
    },
    {
      key: "provider-fetch",
      label: "Provider fetch",
      tone: providerIngested ? "success" : providerFailed ? "danger" : "warning",
      statusLabel: providerIngested ? "Completed" : providerFailed ? "Failed" : "Pending",
      duration: formatMetricDuration(
        readEventDuration(providerIngested?.details, "durationMs") ?? readEventDuration(providerFailed?.details, "durationMs")
      ),
      detail: providerIngested
        ? getProviderFetchDetail(providerIngested)
        : providerFailed
          ? getProviderFailureDetail(providerFailed)
          : "No provider fetch has been recorded yet."
    },
    {
      key: "review-decision",
      label: "Reviewer decision",
      tone: reviewerDecision ? "success" : caseRecord.status === "pending_review" ? "warning" : "neutral",
      statusLabel: reviewerDecision ? "Completed" : caseRecord.status === "pending_review" ? "Pending" : "Not started",
      duration: formatMetricDuration(readEventDuration(reviewerDecision?.details, "durationMs")),
      detail: reviewerDecision
        ? getReviewerDecisionDetail(reviewerDecision)
        : caseRecord.status === "pending_review"
          ? "A human decision is still required before any case action."
          : "The case never reached a persisted reviewer decision."
    }
  ];
}

function formatHours(value: number | null): string {
  if (value == null) {
    return "n/a";
  }

  return value.toFixed(1);
}

function formatDayLabel(day: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${day}T00:00:00.000Z`));
}

function formatMetricDuration(value: number | null): string {
  if (value == null) {
    return "n/a";
  }

  return `${value} ms`;
}

function describeMetricCounts(completedCount: number, failedCount: number, maxDurationMs: number | null): string {
  const maxCopy = maxDurationMs == null ? "no max recorded yet" : `max ${maxDurationMs} ms`;
  return `${completedCount} completed, ${failedCount} failed, ${maxCopy}.`;
}

function findLastAuditEvent(
  auditEvents: AuditEvent[],
  type: AuditEvent["type"]
): AuditEvent | undefined {
  return [...auditEvents].reverse().find((event) => event.type === type);
}

function readEventDuration(
  details: Record<string, unknown> | undefined,
  key: string
): number | null {
  const value = details?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getProviderFetchDetail(event: AuditEvent): string {
  const count = typeof event.details.count === "number" ? event.details.count : 0;
  const source = typeof event.details.source === "string" ? event.details.source : "provider";
  return `${source} returned ${count} transaction samples for this request.`;
}

function getProviderFailureDetail(event: AuditEvent): string {
  const provider = typeof event.details.provider === "string" ? event.details.provider : "provider";
  const errorCode = typeof event.details.errorCode === "string" ? event.details.errorCode : "unknown";
  return `${provider} failed with ${errorCode}; retry with the same idempotency key to recover the case.`;
}

function getReviewerDecisionDetail(event: AuditEvent): string {
  const note = typeof event.details.note === "string" && event.details.note ? event.details.note : "Reviewer note recorded.";
  return note;
}
