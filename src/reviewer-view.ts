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
import type { ReleaseRecordSnapshot } from "./incident-snapshot.ts";
import type { RuntimeParityCiEvidence } from "./runtime-parity.ts";

type StatusTone = "neutral" | "warning" | "danger" | "success";

type TraceStageTone = Extract<StatusTone, "neutral" | "warning" | "danger" | "success">;

const STALLED_PENDING_HOURS = 24;
const BACKLOG_WARNING_COUNT = 5;
const SLOW_STAGE_WARNING_MS = 1500;

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

export type OperationalGuide = {
  title: string;
  tone: StatusTone;
  statusLabel: string;
  summary: string;
  releaseDecision: string;
  rollbackDecision: string;
  actions: string[];
  evidence: string[];
};

export type CaseReleaseRecordSummary = {
  title: string;
  tone: StatusTone;
  summary: string;
  focusCaseLabel: string;
  focusCasePath: string | null;
  focusCaseExportPath: string | null;
};

export type ReplayStatus = {
  event: AuditEvent;
  attemptNumber: number;
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
  const replayStatus = getLatestReplayStatus(auditEvents);

  if (caseRecord.status === "pending_review" && replayStatus?.event.type === "FAILED_CASE_REPLAY_RECOVERED") {
    return `Replay attempt ${replayStatus.attemptNumber} reused the original idempotency key and recovered this case. Review the refreshed evidence before recording the human decision.`;
  }

  if (caseRecord.status !== "ingestion_failed") {
    return null;
  }

  const failedEvent = [...auditEvents].reverse().find((event) => event.type === "PROVIDER_FETCH_FAILED");
  const errorCode =
    typeof failedEvent?.details.errorCode === "string" ? failedEvent.details.errorCode : "unknown";

  if (replayStatus?.event.type === "FAILED_CASE_REPLAY_FAILED") {
    return `Replay attempt ${replayStatus.attemptNumber} reused the original idempotency key, but the latest provider fetch still ended in ${errorCode}. Compare the new trace and runtime state before replaying again.`;
  }

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

export function getWorkspaceOperationalGuide(
  summary: CaseQueueSummary,
  analytics: CaseQueueAnalytics
): OperationalGuide {
  const providerFailures = analytics.operationalMetrics.providerFetch.failedCount;
  const intakeFailures = analytics.operationalMetrics.intakePipeline.failedCount;
  const failedIngestions = summary.failedIngestionCount;
  const oldestPendingHours = analytics.reviewLatency.oldestPendingHours ?? 0;
  const pendingReviewCount = summary.pendingReviewCount;
  const slowestStageMs = Math.max(
    analytics.operationalMetrics.intakePipeline.maxDurationMs ?? 0,
    analytics.operationalMetrics.providerFetch.maxDurationMs ?? 0,
    analytics.operationalMetrics.reviewerDecision.maxDurationMs ?? 0
  );

  if (providerFailures > 0 || intakeFailures > 0 || failedIngestions > 0) {
    return {
      title: "Investigate before release",
      tone: "danger",
      statusLabel: "Hold",
      summary:
        "The current queue contains persisted ingestion or intake failures, so the next release should pause until the failure pattern is understood.",
      releaseDecision:
        "Keep the current build out of wider rollout until a representative failed case can be replayed successfully through the same API path.",
      rollbackDecision:
        "If these failures started immediately after a provider, timeout, or runtime change, roll back that change first, then replay affected cases with the same idempotency keys.",
      actions: [
        "Open a failed case detail and inspect the trace ID, provider error code, and stage durations.",
        "Replay one affected request with the same Idempotency-Key to confirm recovery does not mint duplicate state.",
        "Check whether provider timeout or runtime configuration changed just before the failures appeared."
      ],
      evidence: [
        `${failedIngestions} failed-ingestion cases remain visible in the current queue.`,
        `Provider fetch failures: ${providerFailures}; intake failures: ${intakeFailures}.`,
        `Slowest recorded stage in the filtered queue: ${formatMetricDuration(slowestStageMs || null)}.`
      ]
    };
  }

  if (
    oldestPendingHours >= STALLED_PENDING_HOURS ||
    pendingReviewCount >= BACKLOG_WARNING_COUNT ||
    slowestStageMs >= SLOW_STAGE_WARNING_MS
  ) {
    return {
      title: "Release with operator watch",
      tone: "warning",
      statusLabel: "Watch",
      summary:
        "The queue is healthy enough to continue, but backlog age or stage timing shows enough pressure to warrant a monitored rollout.",
      releaseDecision:
        "Ship only if the reviewer queue is actively watched and the oldest pending cases are not being ignored through the rollout window.",
      rollbackDecision:
        "Rollback is not automatic here; use it only if rollout traffic coincides with rising stage duration or a new failed-ingestion pattern.",
      actions: [
        "Prioritize the oldest pending reviews before widening release scope.",
        "Watch intake and provider stage timings for a sustained increase during the rollout window.",
        "Capture one trace ID from a slow case so the team can compare before and after behavior."
      ],
      evidence: [
        `Oldest pending review age: ${formatHours(analytics.reviewLatency.oldestPendingHours)} hours.`,
        `Pending-review backlog: ${pendingReviewCount} cases.`,
        `Slowest recorded stage in the filtered queue: ${formatMetricDuration(slowestStageMs || null)}.`
      ]
    };
  }

  return {
    title: "Ready for a controlled release",
    tone: "success",
    statusLabel: "Ready",
    summary:
      "The filtered queue has no persisted ingestion failures and no obvious timing or review-latency pressure.",
    releaseDecision:
      "This slice is in a reasonable state for a controlled release because the current queue can be explained from stored case and audit evidence.",
    rollbackDecision:
      "Keep rollback guidance documented, but no current queue signal suggests that the latest runtime or provider behavior should be reversed.",
    actions: [
      "Spot-check one recent approved or pending case to confirm the reviewer path still matches the runbook.",
      "Record the current queue counts and slowest stage before releasing so regressions are easy to compare.",
      "Proceed with a narrow rollout first and keep trace IDs visible during smoke testing."
    ],
    evidence: [
      `${summary.total} visible cases in the filtered queue with ${summary.failedIngestionCount} failed ingestions.`,
      `Oldest pending review age: ${formatHours(analytics.reviewLatency.oldestPendingHours)} hours.`,
      `Slowest recorded stage in the filtered queue: ${formatMetricDuration(slowestStageMs || null)}.`
    ]
  };
}

export function getCaseOperationalGuide(caseRecord: CaseRecord, auditEvents: AuditEvent[]): OperationalGuide {
  const intakePending = findLastAuditEvent(auditEvents, "HUMAN_REVIEW_PENDING");
  const providerFailed = findLastAuditEvent(auditEvents, "PROVIDER_FETCH_FAILED");
  const providerIngested = findLastAuditEvent(auditEvents, "TRANSACTIONS_INGESTED");
  const reviewerDecision =
    findLastAuditEvent(auditEvents, "HUMAN_APPROVED") ?? findLastAuditEvent(auditEvents, "HUMAN_REJECTED");
  const intakeDuration =
    readEventDuration(intakePending?.details, "durationMs") ??
    readEventDuration(providerFailed?.details, "intakeDurationMs");
  const providerDuration =
    readEventDuration(providerIngested?.details, "durationMs") ??
    readEventDuration(providerFailed?.details, "durationMs");
  const reviewerDuration = readEventDuration(reviewerDecision?.details, "durationMs");

  if (caseRecord.status === "ingestion_failed") {
    const errorCode =
      typeof providerFailed?.details.errorCode === "string" ? providerFailed.details.errorCode : "unknown";
    const replayStatus = getLatestReplayStatus(auditEvents);
    const replayEvidence = replayStatus
      ? replayStatus.event.type === "FAILED_CASE_REPLAY_FAILED"
        ? `Replay attempt ${replayStatus.attemptNumber} already repeated the failure through the same API path.`
        : `Replay attempt ${replayStatus.attemptNumber} already recovered this case through the same API path.`
      : "No reviewer-triggered replay attempt has been recorded yet.";

    return {
      title: "Retry-safe incident response required",
      tone: "danger",
      statusLabel: "Incident",
      summary:
        "This case never reached reviewer-ready state because provider ingestion failed, so it is the strongest rollback and replay signal in the current workflow.",
      releaseDecision:
        "Do not widen rollout from this case state. First prove that one failed case can recover through the same API path without creating duplicate rows.",
      rollbackDecision:
        "If the failure started right after a provider, timeout, or runtime change, roll back that change and retry this case with the same idempotency key.",
      actions: [
        "Inspect the provider failure code and trace ID in the audit timeline.",
        "Retry the intake with the same Idempotency-Key so recovery updates the original case instead of duplicating state.",
        "Compare the provider timeout and runtime configuration with the last known healthy run."
      ],
      evidence: [
        `Provider status: ${getProviderSummary(caseRecord.sourceMetadata)}.`,
        `Provider failure code: ${errorCode}.`,
        `Intake duration ${formatMetricDuration(intakeDuration)}; provider duration ${formatMetricDuration(providerDuration)}.`,
        replayEvidence
      ]
    };
  }

  if (caseRecord.status === "pending_review") {
    const replayStatus = getLatestReplayStatus(auditEvents);
    const replayEvidence =
      replayStatus?.event.type === "FAILED_CASE_REPLAY_RECOVERED"
        ? `Recovered on replay attempt ${replayStatus.attemptNumber} with the original idempotency key before this review step.`
        : `Trace ID: ${caseRecord.traceId}.`;

    return {
      title: "Ready for human review completion",
      tone: caseRecord.risk.level === "high" ? "warning" : "neutral",
      statusLabel: caseRecord.risk.level === "high" ? "Watch" : "Queue",
      summary:
        "Automation completed the intake path, but the release gate is still the human decision and note capture on this case.",
      releaseDecision:
        "This case can stay in the current release only if reviewer note capture remains mandatory and the audit history still matches the UI state after refresh.",
      rollbackDecision:
        "No rollback is implied by this case alone. Roll back only if pending cases start stalling or timing increases after a change.",
      actions: [
        "Review the deterministic indicators and transaction sample before approving or rejecting.",
        "Record a reviewer note that explains the decision and any caveat worth preserving in the audit log.",
        "Use the trace ID if the detail page and API response ever disagree after refresh."
      ],
      evidence: [
        `Risk level: ${caseRecord.risk.level} (${caseRecord.risk.score}).`,
        `Intake duration ${formatMetricDuration(intakeDuration)}; provider duration ${formatMetricDuration(providerDuration)}.`,
        replayEvidence
      ]
    };
  }

  return {
    title: "Case completed with traceable evidence",
    tone: "success",
    statusLabel: "Completed",
    summary:
      "The workflow reached a persisted reviewer decision, so the case now serves as release evidence rather than an open operational risk.",
    releaseDecision:
      "This case supports release confidence because the reviewer path, note capture, and persisted timing all completed through the intended API boundary.",
    rollbackDecision:
      "No rollback action is suggested by this completed case. Preserve it as a comparison point if a later rollout introduces regressions.",
    actions: [
      "Use the reviewer note and stage durations as a known-good example during smoke testing.",
      "Compare later regressions against this trace before changing provider or runtime configuration again.",
      "Keep the audit timeline immutable so approval evidence remains explainable."
    ],
    evidence: [
      `Final status: ${caseRecord.status}.`,
      `Reviewer duration ${formatMetricDuration(reviewerDuration)} after intake ${formatMetricDuration(intakeDuration)} and provider ${formatMetricDuration(providerDuration)}.`,
      `Reviewer note: ${caseRecord.reviewerNote ?? "Not recorded"}.`
    ]
  };
}

export function getCaseReleaseRecordSummary(
  caseRecord: CaseRecord,
  releaseRecord: ReleaseRecordSnapshot
): CaseReleaseRecordSummary {
  const focusCasePath = releaseRecord.evidence.focusCasePath;
  const focusCaseExportPath = releaseRecord.evidence.focusCaseExportPath;
  const currentCasePath = `/cases/${caseRecord.id}`;
  const releaseTone = getReleaseStatusTone(releaseRecord.release.statusLabel);

  if (!focusCasePath) {
    return {
      title: "Latest release record has no focus case",
      tone: "neutral",
      summary:
        "The current filtered release record did not pick a focus case, so use the rollback triggers and export links as queue-level guidance only.",
      focusCaseLabel: "No focus case is attached to the latest release record.",
      focusCasePath: null,
      focusCaseExportPath: null
    };
  }

  if (focusCasePath === currentCasePath) {
    return {
      title: "This case anchors the latest release record",
      tone: releaseTone,
      summary:
        "The current release record points to this case as the rollback drill anchor, so this detail view now carries the same focus path the workspace release panel exports.",
      focusCaseLabel: "This case is the current release focus case.",
      focusCasePath,
      focusCaseExportPath
    };
  }

  return {
    title: "Compare this case against the release focus case",
    tone: releaseTone === "success" ? "warning" : releaseTone,
    summary:
      "The latest release record is anchored to another case, so use that focus case for the rollback drill and treat this detail view as comparison evidence from the same queue.",
    focusCaseLabel: `Latest focus case: ${focusCasePath}.`,
    focusCasePath,
    focusCaseExportPath
  };
}

export function getReviewArtifactCaptureSummary(reviewArtifact: RuntimeParityCiEvidence | null): string {
  if (!reviewArtifact) {
    return "No GitHub Actions review artifact is attached to the latest parity result.";
  }

  const hostReadinessCapture = reviewArtifact.captures?.hostReadiness;
  if (!hostReadinessCapture) {
    return `${reviewArtifact.artifactName} is attached, but CI capture status was not recorded on this parity artifact.`;
  }

  if (hostReadinessCapture.status === "captured") {
    const statusLabel = hostReadinessCapture.statusLabel ? ` (${hostReadinessCapture.statusLabel})` : "";
    return `${reviewArtifact.artifactName} captured host-readiness successfully${statusLabel} in the matching GitHub Actions bundle.`;
  }

  return `${reviewArtifact.artifactName} did not capture host-readiness successfully; inspect the bundle or rerun CI evidence capture.`;
}

export function getReviewArtifactExpectedFiles(reviewArtifact: RuntimeParityCiEvidence | null): string {
  if (!reviewArtifact?.artifactFiles.length) {
    return "Artifact file list is not recorded on this parity result.";
  }

  return reviewArtifact.artifactFiles.join(", ");
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

export function getLatestReplayStatus(auditEvents: AuditEvent[]): ReplayStatus | null {
  const event = [...auditEvents]
    .reverse()
    .find(
      (candidate) =>
        candidate.type === "FAILED_CASE_REPLAY_RECOVERED" || candidate.type === "FAILED_CASE_REPLAY_FAILED"
    );

  if (!event) {
    return null;
  }

  const replayAttempt = event.details.replayAttempt;
  return {
    event,
    attemptNumber: typeof replayAttempt === "number" && Number.isFinite(replayAttempt) ? replayAttempt : 1
  };
}

function getReleaseStatusTone(statusLabel: ReleaseRecordSnapshot["release"]["statusLabel"]): StatusTone {
  switch (statusLabel) {
    case "Hold":
      return "danger";
    case "Watch":
      return "warning";
    case "Ready":
      return "success";
    default:
      return "neutral";
  }
}
