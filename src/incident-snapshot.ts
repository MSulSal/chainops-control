import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import type {
  AuditEvent,
  CaseListFilters,
  CaseQueueAnalytics,
  CaseQueueSummary,
  CaseRecord,
  CaseSummary
} from "./domain.ts";
import {
  getCaseDetailCallout,
  getCaseOperationalGuide,
  getLatestReplayStatus,
  getCaseStageTrace,
  getCaseListSubtitle,
  getProviderSummary,
  getReviewArtifactFocusCaseArtifactHint,
  getReviewArtifactReplayCaptureSummary,
  getWorkspaceOperationalGuide
} from "./reviewer-view.ts";
import type { HostReadinessSnapshot } from "./host-readiness.ts";
import type { RuntimeParityCiEvidence, RuntimeParityResult } from "./runtime-parity.ts";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

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
  releaseHandoff: {
    summary: string;
    releaseRecordPath: "/exports/releases/latest";
    releaseStatusLabel: ReleaseRecordSnapshot["release"]["statusLabel"];
    focusCase: {
      isCurrentFocusCase: boolean;
      focusCasePath: string | null;
      focusCaseExportPath: string | null;
    };
    runtimeParity: {
      status: RuntimeParityResult["status"] | "not_recorded";
      checkedAt: string | null;
      summary: string;
      artifactPath: "/exports/runtime-parity/latest";
      reviewHint: string | null;
    };
    replay: ReleaseRecordSnapshot["evidence"]["replay"];
    hostReadiness: {
      statusLabel: HostReadinessSnapshot["overall"]["statusLabel"] | "Not recorded";
      summary: string;
      artifactPath: "/exports/host-readiness";
      missingRequirements: string[];
      nextSteps: string[];
    };
  };
  auditEvents: AuditEvent[];
};

export type TelemetryHandoffSnapshot = {
  generatedAt: string;
  scope: "telemetry_handoff";
  service: {
    name: "chainops-control";
    api: {
      healthPath: string;
      readyPath: string;
      demoResetPath: string;
      workspaceExportPath: string;
      openTelemetryExportPath: string;
      releaseRecordPath: string;
    };
    reviewer: {
      workspacePath: string;
    };
  };
  smoke: {
    demoCommand: string;
    runtimeCommand: string;
    terraformSandboxPath: string;
  };
  seededDemo: {
    scenario: string;
    expectedTraceIds: string[];
    notes: string[];
  };
  queueEvidence: {
    filters: CaseListFilters;
    summary: CaseQueueSummary;
    analytics: CaseQueueAnalytics;
    releaseGuide: ReturnType<typeof getWorkspaceOperationalGuide>;
    traceSamples: Array<{
      id: string;
      traceId: string;
      status: CaseSummary["status"];
      providerSummary: string;
      casePath: string;
      caseExportPath: string;
      callout: string | null;
    }>;
  };
  collectorNotes: {
    status: "bounded_planning_only";
    goals: string[];
    recommendedMappings: Array<{
      signal: string;
      source: string;
      handoff: string;
    }>;
    currentLimits: string[];
  };
};

export type OpenTelemetryExportSnapshot = {
  generatedAt: string;
  scope: "opentelemetry_export";
  resource: {
    serviceName: "chainops-control";
    serviceVersion: string;
    deploymentEnvironment: "local";
    runtimeChannel: "local_container_runtime";
  };
  filters: CaseListFilters;
  summary: CaseQueueSummary;
  links: {
    telemetryHandoffPath: string;
    workspaceSnapshotPath: string;
    releaseRecordPath: string;
  };
  traces: Array<{
    caseId: string;
    traceId: string;
    walletAddress: string;
    status: CaseRecord["status"];
    spans: Array<{
      traceId: string;
      spanId: string;
      parentSpanId: string | null;
      name: string;
      kind: "internal";
      startTime: string;
      endTime: string;
      status: {
        code: "OK" | "ERROR" | "UNSET";
        message?: string;
      };
      attributes: Record<string, string | number | boolean>;
    }>;
  }>;
  metrics: Array<{
    name: string;
    description: string;
    unit: "ms" | "1";
    aggregationTemporality: "cumulative";
    dataPoints: Array<{
      attributes: Record<string, string>;
      value: number;
    }>;
  }>;
  boundaries: string[];
};

export type ReleaseRecordSnapshot = {
  generatedAt: string;
  scope: "release_record";
  filters: CaseListFilters;
  release: {
    version: string;
    channel: "local_container_runtime";
    statusLabel: ReturnType<typeof getWorkspaceOperationalGuide>["statusLabel"];
    summary: string;
    containerImages: {
      api: string;
      postgres: string;
    };
    reviewerWorkspacePath: string;
  };
  verification: {
    requiredCommands: Array<{
      name: string;
      command: string;
      purpose: string;
    }>;
    endpoints: {
      healthPath: string;
      readyPath: string;
      demoResetPath: string;
      workspaceExportPath: string;
      telemetryExportPath: string;
      openTelemetryExportPath: string;
      hostReadinessPath: string;
      releaseRecordPath: string;
    };
    seededScenario: {
      name: string;
      expectedTraceIds: string[];
    };
    seededReplay: {
      actionPathTemplate: "/cases/:id/replay";
      expectedOutcome: string;
    };
    hostReadiness: {
      artifactPath: string;
      failureMode: string;
      lastResult: HostReadinessSnapshot | null;
    };
    runtimeParity: {
      comparedExports: string[];
      ignoredFields: string[];
      failureMode: string;
      lastResult: RuntimeParityResult | null;
      reviewArtifact: RuntimeParityCiEvidence | null;
      focusCaseReplayArtifact: {
        fileName: "focus-case-incident-snapshot.json";
        captureStatus: "captured" | "missing" | "unavailable";
        replayStatus: "recovered" | "failed_again" | "not_attempted" | "not_applicable" | null;
        summary: string;
        artifactHint: string;
      };
    };
  };
  evidence: {
    summary: CaseQueueSummary;
    analytics: CaseQueueAnalytics;
    releaseGuide: ReturnType<typeof getWorkspaceOperationalGuide>;
    telemetryHandoffPath: string;
    workspaceSnapshotPath: string;
    focusCasePath: string | null;
    focusCaseExportPath: string | null;
    focusTraceId: string | null;
    replay: {
      status: "recovered" | "failed_again" | "not_attempted" | "not_applicable";
      summary: string;
      replayAttempt: number | null;
      casePath: string | null;
      caseExportPath: string | null;
      traceId: string | null;
      history: Array<{
        attempt: number;
        status: "recovered" | "failed_again";
        at: string;
        traceId: string;
        summary: string;
      }>;
    };
  };
  rollback: {
    decision: string;
    triggers: string[];
    evidence: string[];
  };
  boundaries: string[];
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
  releaseRecord?: ReleaseRecordSnapshot | null;
}): CaseIncidentSnapshot {
  const releaseRecord = input.releaseRecord ?? null;
  const runtimeParityResult = releaseRecord?.verification.runtimeParity.lastResult ?? null;
  const hostReadinessSnapshot = releaseRecord?.verification.hostReadiness.lastResult ?? null;
  const focusCasePath = releaseRecord?.evidence.focusCasePath ?? null;
  const focusCaseExportPath = releaseRecord?.evidence.focusCaseExportPath ?? null;

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    scope: "case",
    caseRecord: input.caseRecord,
    providerSummary: getProviderSummary(input.caseRecord.sourceMetadata),
    stageTrace: getCaseStageTrace(input.caseRecord, input.auditEvents),
    incidentGuide: getCaseOperationalGuide(input.caseRecord, input.auditEvents),
    releaseHandoff: {
      summary:
        releaseRecord?.release.summary ??
        "Release handoff context is unavailable for this case export. Fetch /exports/releases/latest separately.",
      releaseRecordPath: "/exports/releases/latest",
      releaseStatusLabel: releaseRecord?.release.statusLabel ?? "Watch",
      focusCase: {
        isCurrentFocusCase: focusCasePath === `/cases/${input.caseRecord.id}`,
        focusCasePath,
        focusCaseExportPath
      },
      runtimeParity: {
        status: runtimeParityResult?.status ?? "not_recorded",
        checkedAt: runtimeParityResult?.checkedAt ?? null,
        summary:
          runtimeParityResult?.summary ??
          "No persisted runtime parity result is attached to the latest release record.",
        artifactPath: "/exports/runtime-parity/latest",
        reviewHint: runtimeParityResult?.ciEvidence?.reviewHint ?? null
      },
      replay: releaseRecord?.evidence.replay ?? {
        status: "not_applicable",
        summary: "The latest release record did not attach replay evidence to this case export.",
        replayAttempt: null,
        casePath: null,
        caseExportPath: null,
        traceId: null,
        history: []
      },
      hostReadiness: {
        statusLabel: hostReadinessSnapshot?.overall.statusLabel ?? "Not recorded",
        summary:
          hostReadinessSnapshot?.overall.summary ??
          "No host-readiness artifact is attached to the latest release record.",
        artifactPath: "/exports/host-readiness",
        missingRequirements: hostReadinessSnapshot?.providerSandbox.missingRequirements ?? [],
        nextSteps: hostReadinessSnapshot?.providerSandbox.nextSteps ?? []
      }
    },
    auditEvents: input.auditEvents
  };
}

export function buildTelemetryHandoffSnapshot(input: {
  generatedAt?: string;
  filters: CaseListFilters;
  summary: CaseQueueSummary;
  analytics: CaseQueueAnalytics;
  cases: CaseSummary[];
}): TelemetryHandoffSnapshot {
  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    scope: "telemetry_handoff",
    service: {
      name: "chainops-control",
      api: {
        healthPath: "/health",
        readyPath: "/ready",
        demoResetPath: "/demo/reset",
        workspaceExportPath: "/exports/workspace",
        openTelemetryExportPath: "/exports/telemetry/opentelemetry",
        releaseRecordPath: "/exports/releases/latest"
      },
      reviewer: {
        workspacePath: "/"
      }
    },
    smoke: {
      demoCommand: "npm run smoke:demo",
      runtimeCommand: "npm run smoke:runtime",
      terraformSandboxPath: "infra/terraform/sandbox"
    },
    seededDemo: {
      scenario: "incident_review_v1",
      expectedTraceIds: [
        "trace-demo-provider-timeout",
        "trace-demo-pending-high",
        "trace-demo-approved-low"
      ],
      notes: [
        "Reset the local demo dataset before comparing telemetry evidence across runs.",
        "Only generatedAt and current pending-review age should move between identical seeded resets."
      ]
    },
    queueEvidence: {
      filters: input.filters,
      summary: input.summary,
      analytics: input.analytics,
      releaseGuide: getWorkspaceOperationalGuide(input.summary, input.analytics),
      traceSamples: input.cases.slice(0, 5).map((caseItem) => ({
        id: caseItem.id,
        traceId: caseItem.traceId,
        status: caseItem.status,
        providerSummary: getProviderSummary(caseItem.sourceMetadata),
        casePath: `/cases/${caseItem.id}`,
        caseExportPath: `/exports/cases/${caseItem.id}`,
        callout: getCaseDetailCallout(
          {
            ...caseItem,
            transactions: [],
            risk: caseItem.risk
          },
          []
        )
      }))
    },
    collectorNotes: {
      status: "bounded_planning_only",
      goals: [
        "Keep health and readiness checks attached to the same API boundary already exercised by runtime smoke.",
        "Forward persisted timing evidence before introducing a second metric store or alerting system.",
        "Preserve trace IDs from intake through reviewer decisions so incident snapshots and collector exports can be correlated."
      ],
      recommendedMappings: [
        {
          signal: "Health and readiness",
          source: "GET /health and GET /ready",
          handoff: "Configure the future collector or uptime monitor to poll these exact paths before scraping any deeper evidence."
        },
        {
          signal: "Seeded runtime smoke",
          source: "npm run smoke:demo and npm run smoke:runtime",
          handoff: "Publish smoke pass or fail results alongside the same trace IDs and exported snapshots used in the reviewer workspace."
        },
        {
          signal: "Request-stage timing",
          source: "Persisted audit-event durationMs fields for intake, provider fetch, and reviewer decisions",
          handoff: "Transform audit-event timing into metrics in the collector layer instead of duplicating timers inside the application."
        },
        {
          signal: "Case-level incident evidence",
          source: "GET /exports/workspace and GET /exports/cases/:id",
          handoff: "Attach exported JSON snapshots to incident tickets or release notes until a dedicated trace backend exists."
        }
      ],
      currentLimits: [
        "No external collector, trace backend, or alerting service is provisioned in this repository.",
        "Operational metrics are derived from persisted audit events rather than emitted through OpenTelemetry SDK instrumentation.",
        "The Terraform sandbox records the runtime contract only; it does not deploy collectors or managed infrastructure."
      ]
    }
  };
}

export function buildReleaseRecordSnapshot(input: {
  generatedAt?: string;
  filters: CaseListFilters;
  summary: CaseQueueSummary;
  analytics: CaseQueueAnalytics;
  cases: CaseSummary[];
  caseDetails?: Array<{
    caseRecord: CaseRecord;
    auditEvents: AuditEvent[];
  }>;
  lastHostReadinessSnapshot?: HostReadinessSnapshot | null;
  lastRuntimeParityResult?: RuntimeParityResult | null;
}): ReleaseRecordSnapshot {
  const releaseGuide = getWorkspaceOperationalGuide(input.summary, input.analytics);
  const focusCaseDetail =
    input.caseDetails?.find(
      (detail) => getLatestReplayStatus(detail.auditEvents)?.event.type === "FAILED_CASE_REPLAY_RECOVERED"
    ) ??
    input.caseDetails?.find(
      (detail) => getLatestReplayStatus(detail.auditEvents)?.event.type === "FAILED_CASE_REPLAY_FAILED"
    ) ??
    input.caseDetails?.find((detail) => detail.caseRecord.status === "ingestion_failed") ??
    input.caseDetails?.find((detail) => detail.caseRecord.status === "pending_review") ??
    input.caseDetails?.[0] ??
    null;
  const focusCase =
    focusCaseDetail?.caseRecord ??
    input.cases.find((caseItem) => caseItem.status === "ingestion_failed") ??
    input.cases.find((caseItem) => caseItem.status === "pending_review") ??
    input.cases[0];
  const replayEvidence = buildReplayEvidence(focusCaseDetail);
  const reviewArtifact = input.lastRuntimeParityResult?.ciEvidence ?? null;

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    scope: "release_record",
    filters: input.filters,
    release: {
      version: packageJson.version,
      channel: "local_container_runtime",
      statusLabel: releaseGuide.statusLabel,
      summary: releaseGuide.summary,
      containerImages: {
        api: "local Dockerfile build via docker compose service api",
        postgres: "postgres:16-alpine"
      },
      reviewerWorkspacePath: "/"
    },
    verification: {
      requiredCommands: [
        {
          name: "unit_and_api_contracts",
          command: "npm test",
          purpose: "Verify service behavior, export contracts, and failure-path coverage."
        },
        {
          name: "seeded_demo_smoke",
          command: "npm run smoke:demo",
          purpose: "Reset the seeded incident scenario and verify export stability over HTTP."
        },
        {
          name: "container_runtime_smoke",
          command: "npm run smoke:runtime",
          purpose: "Wait for /health and /ready against the running containerized API, then rerun the seeded smoke flow."
        },
        {
          name: "reviewer_workspace_build",
          command: "npm run build:web",
          purpose: "Keep the Next.js reviewer workspace shippable alongside the API release record."
        }
      ],
      endpoints: {
        healthPath: "/health",
        readyPath: "/ready",
        demoResetPath: "/demo/reset",
        workspaceExportPath: "/exports/workspace",
        telemetryExportPath: "/exports/telemetry",
        openTelemetryExportPath: "/exports/telemetry/opentelemetry",
        hostReadinessPath: "/exports/host-readiness",
        releaseRecordPath: "/exports/releases/latest"
      },
      seededScenario: {
        name: "incident_review_v1",
        expectedTraceIds: [
          "trace-demo-provider-timeout",
          "trace-demo-pending-high",
          "trace-demo-approved-low"
        ]
      },
      seededReplay: {
        actionPathTemplate: "/cases/:id/replay",
        expectedOutcome:
          "Replay the seeded failed-ingestion case through the live HTTP boundary and confirm the original case recovers or records a repeated failure without duplicating state."
      },
      hostReadiness: {
        artifactPath: "/exports/host-readiness",
        failureMode:
          "Treat the first provider-backed sandbox attempt as blocked until the latest host-readiness artifact reports Docker, Compose, Terraform, and live-provider prerequisites as ready on the current host.",
        lastResult: input.lastHostReadinessSnapshot ?? null
      },
      runtimeParity: {
        comparedExports: [
          "/exports/telemetry",
          "/exports/telemetry/opentelemetry",
          "/exports/releases/latest"
        ],
        ignoredFields: [
          "generatedAt",
          "queueEvidence.analytics.reviewLatency.oldestPendingHours",
          "queueEvidence.releaseGuide.evidence[*] old pending-review age text",
          "evidence.analytics.reviewLatency.oldestPendingHours",
          "evidence.releaseGuide.evidence[*] old pending-review age text",
          "rollback.evidence[*] old pending-review age text"
        ],
        failureMode:
          "Treat the runtime as stale when any required export is missing or diverges from the current seeded parity contract after normalizing the documented time-relative fields.",
        lastResult: input.lastRuntimeParityResult ?? null,
        reviewArtifact,
        focusCaseReplayArtifact: {
          fileName: "focus-case-incident-snapshot.json",
          captureStatus: reviewArtifact?.captures?.focusCaseSnapshot.status ?? "unavailable",
          replayStatus:
            reviewArtifact?.captures?.focusCaseSnapshot.replayStatus ?? replayEvidence.status,
          summary: getReviewArtifactReplayCaptureSummary(reviewArtifact),
          artifactHint: getReviewArtifactFocusCaseArtifactHint(reviewArtifact)
        }
      }
    },
    evidence: {
      summary: input.summary,
      analytics: input.analytics,
      releaseGuide,
      telemetryHandoffPath: "/exports/telemetry",
      workspaceSnapshotPath: "/exports/workspace",
      focusCasePath: focusCase ? `/cases/${focusCase.id}` : null,
      focusCaseExportPath: focusCase ? `/exports/cases/${focusCase.id}` : null,
      focusTraceId: focusCase?.traceId ?? null,
      replay: replayEvidence
    },
    rollback: {
      decision: releaseGuide.rollbackDecision,
      triggers: [
        "Roll back only when failed ingestions or stage-duration regressions line up with a recent provider, timeout, or runtime change.",
        "Replay an affected request with the same Idempotency-Key after the rollback to prove recovery without duplicate state.",
        "Compare the latest telemetry handoff and case export artifacts against the last known healthy seeded runtime smoke run."
      ],
      evidence: [
        ...releaseGuide.evidence,
        focusCase
          ? `Focus case for rollback drill: ${focusCase.id} / trace ${focusCase.traceId}.`
          : "No focus case is available in the current filtered queue."
      ]
    },
    boundaries: [
      "This release record describes the current local container/runtime contract only; it does not claim a managed deployment target.",
      "No external collector, trace backend, or alerting service is provisioned by this artifact.",
      "Release and rollback guidance remain operator-facing recommendations derived from persisted case and audit evidence."
    ]
  };
}

function buildReplayEvidence(
  focusCaseDetail:
    | {
        caseRecord: CaseRecord;
        auditEvents: AuditEvent[];
      }
    | null
): ReleaseRecordSnapshot["evidence"]["replay"] {
  if (!focusCaseDetail) {
    return {
      status: "not_applicable",
      summary: "No focus case is available for replay evidence in the current filtered queue.",
      replayAttempt: null,
      casePath: null,
      caseExportPath: null,
      traceId: null,
      history: []
    };
  }

  const replayStatus = getLatestReplayStatus(focusCaseDetail.auditEvents);
  const replayHistory = buildReplayHistory(focusCaseDetail.auditEvents);
  const casePath = `/cases/${focusCaseDetail.caseRecord.id}`;
  const caseExportPath = `/exports/cases/${focusCaseDetail.caseRecord.id}`;

  if (replayStatus?.event.type === "FAILED_CASE_REPLAY_RECOVERED") {
    return {
      status: "recovered",
      summary:
        getCaseDetailCallout(focusCaseDetail.caseRecord, focusCaseDetail.auditEvents) ??
        `Replay attempt ${replayStatus.attemptNumber} recovered the focus case through the same API path.`,
      replayAttempt: replayStatus.attemptNumber,
      casePath,
      caseExportPath,
      traceId: focusCaseDetail.caseRecord.traceId,
      history: replayHistory
    };
  }

  if (replayStatus?.event.type === "FAILED_CASE_REPLAY_FAILED") {
    return {
      status: "failed_again",
      summary:
        getCaseDetailCallout(focusCaseDetail.caseRecord, focusCaseDetail.auditEvents) ??
        `Replay attempt ${replayStatus.attemptNumber} repeated the failure through the same API path.`,
      replayAttempt: replayStatus.attemptNumber,
      casePath,
      caseExportPath,
      traceId: focusCaseDetail.caseRecord.traceId,
      history: replayHistory
    };
  }

  if (focusCaseDetail.caseRecord.status === "ingestion_failed") {
    return {
      status: "not_attempted",
      summary:
        getCaseDetailCallout(focusCaseDetail.caseRecord, focusCaseDetail.auditEvents) ??
        "The focus case is still failed and has not recorded a reviewer-triggered replay attempt yet.",
      replayAttempt: null,
      casePath,
      caseExportPath,
      traceId: focusCaseDetail.caseRecord.traceId,
      history: replayHistory
    };
  }

  return {
    status: "not_applicable",
    summary: "The current release focus case has no replay evidence attached.",
    replayAttempt: null,
    casePath,
    caseExportPath,
    traceId: focusCaseDetail.caseRecord.traceId,
    history: replayHistory
  };
}

function buildReplayHistory(auditEvents: AuditEvent[]): ReleaseRecordSnapshot["evidence"]["replay"]["history"] {
  return auditEvents
    .filter(
      (event) =>
        event.type === "FAILED_CASE_REPLAY_RECOVERED" || event.type === "FAILED_CASE_REPLAY_FAILED"
    )
    .map((event) => ({
      attempt:
        typeof event.details.replayAttempt === "number" && Number.isFinite(event.details.replayAttempt)
          ? event.details.replayAttempt
          : 1,
      status: event.type === "FAILED_CASE_REPLAY_RECOVERED" ? ("recovered" as const) : ("failed_again" as const),
      at: event.at,
      traceId: event.traceId,
      summary:
        event.type === "FAILED_CASE_REPLAY_RECOVERED"
          ? `Replay attempt ${
              typeof event.details.replayAttempt === "number" && Number.isFinite(event.details.replayAttempt)
                ? event.details.replayAttempt
                : 1
            } recovered the case through the same API path.`
          : `Replay attempt ${
              typeof event.details.replayAttempt === "number" && Number.isFinite(event.details.replayAttempt)
                ? event.details.replayAttempt
                : 1
            } repeated the failure through the same API path${
              event.details.errorCode ? ` with ${(event.details.errorCode as string)}.` : "."
            }`
    }));
}

export function buildOpenTelemetryExportSnapshot(input: {
  generatedAt?: string;
  filters: CaseListFilters;
  summary: CaseQueueSummary;
  analytics: CaseQueueAnalytics;
  caseDetails: Array<{
    caseRecord: CaseRecord;
    auditEvents: AuditEvent[];
  }>;
}): OpenTelemetryExportSnapshot {
  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    scope: "opentelemetry_export",
    resource: {
      serviceName: "chainops-control",
      serviceVersion: packageJson.version,
      deploymentEnvironment: "local",
      runtimeChannel: "local_container_runtime"
    },
    filters: input.filters,
    summary: input.summary,
    links: {
      telemetryHandoffPath: "/exports/telemetry",
      workspaceSnapshotPath: "/exports/workspace",
      releaseRecordPath: "/exports/releases/latest"
    },
    traces: input.caseDetails.slice(0, 5).map((detail) => ({
      caseId: detail.caseRecord.id,
      traceId: detail.caseRecord.traceId,
      walletAddress: detail.caseRecord.walletAddress,
      status: detail.caseRecord.status,
      spans: buildTraceSpans(detail.caseRecord, detail.auditEvents)
    })),
    metrics: buildOpenTelemetryMetrics(input.analytics),
    boundaries: [
      "This export is a local JSON seam for collector wiring and review; it does not emit OTLP traffic on its own.",
      "Span timing comes from persisted audit-event durations and timestamps that already power the reviewer workspace.",
      "No external collector, trace backend, alerting system, or managed deployment target is provisioned by this artifact."
    ]
  };
}

function buildTraceSpans(caseRecord: CaseRecord, auditEvents: AuditEvent[]) {
  const intakeEvent =
    findLastAuditEvent(auditEvents, "HUMAN_REVIEW_PENDING") ?? findLastAuditEvent(auditEvents, "PROVIDER_FETCH_FAILED");
  const providerEvent =
    findLastAuditEvent(auditEvents, "TRANSACTIONS_INGESTED") ?? findLastAuditEvent(auditEvents, "PROVIDER_FETCH_FAILED");
  const reviewerEvent =
    findLastAuditEvent(auditEvents, "HUMAN_APPROVED") ?? findLastAuditEvent(auditEvents, "HUMAN_REJECTED");

  const intakeSpan = intakeEvent
    ? buildSpan({
        caseRecord,
        event: intakeEvent,
        stage: "intake_pipeline",
        parentSpanId: null,
        durationMs:
          readEventDuration(intakeEvent.details, "durationMs") ?? readEventDuration(intakeEvent.details, "intakeDurationMs"),
        statusCode: intakeEvent.type === "PROVIDER_FETCH_FAILED" ? "ERROR" : "OK",
        statusMessage:
          intakeEvent.type === "PROVIDER_FETCH_FAILED" ? "provider fetch failed before review-ready state" : undefined
      })
    : null;

  const providerSpan = providerEvent
    ? buildSpan({
        caseRecord,
        event: providerEvent,
        stage: "provider_fetch",
        parentSpanId: intakeSpan?.spanId ?? null,
        durationMs: readEventDuration(providerEvent.details, "durationMs"),
        statusCode: providerEvent.type === "PROVIDER_FETCH_FAILED" ? "ERROR" : "OK",
        statusMessage:
          providerEvent.type === "PROVIDER_FETCH_FAILED"
            ? String(providerEvent.details.errorCode ?? "provider fetch failed")
            : undefined
      })
    : null;

  const reviewerSpan = reviewerEvent
    ? buildSpan({
        caseRecord,
        event: reviewerEvent,
        stage: "reviewer_decision",
        parentSpanId: providerSpan?.spanId ?? intakeSpan?.spanId ?? null,
        durationMs: readEventDuration(reviewerEvent.details, "durationMs"),
        statusCode: "OK"
      })
    : null;

  return [intakeSpan, providerSpan, reviewerSpan].filter((value): value is NonNullable<typeof value> => value !== null);
}

function buildSpan(input: {
  caseRecord: CaseRecord;
  event: AuditEvent;
  stage: "intake_pipeline" | "provider_fetch" | "reviewer_decision";
  parentSpanId: string | null;
  durationMs: number | null;
  statusCode: "OK" | "ERROR" | "UNSET";
  statusMessage?: string;
}) {
  const endTime = new Date(input.event.at);
  const startTime =
    input.durationMs != null ? new Date(endTime.getTime() - input.durationMs).toISOString() : input.event.at;

  return {
    traceId: buildTraceHex(input.caseRecord.traceId),
    spanId: buildSpanHex(`${input.caseRecord.id}:${input.stage}:${input.event.type}`),
    parentSpanId: input.parentSpanId,
    name: `chainops.${input.stage}`,
    kind: "internal" as const,
    startTime,
    endTime: input.event.at,
    status: input.statusMessage ? { code: input.statusCode, message: input.statusMessage } : { code: input.statusCode },
    attributes: {
      "chainops.case.id": input.caseRecord.id,
      "chainops.case.status": input.caseRecord.status,
      "chainops.risk.level": input.caseRecord.risk.level,
      "chainops.trace.id": input.caseRecord.traceId,
      "chainops.wallet.address": input.caseRecord.walletAddress,
      "chainops.stage": input.stage,
      "chainops.audit.event_type": input.event.type,
      "chainops.duration.ms": input.durationMs ?? -1
    }
  };
}

function buildOpenTelemetryMetrics(analytics: CaseQueueAnalytics): OpenTelemetryExportSnapshot["metrics"] {
  return [
    buildMetric(
      "chainops.intake_pipeline.duration",
      "Persisted intake timing derived from audit-event evidence.",
      "ms",
      analytics.operationalMetrics.intakePipeline
    ),
    buildMetric(
      "chainops.provider_fetch.duration",
      "Persisted provider timing derived from audit-event evidence.",
      "ms",
      analytics.operationalMetrics.providerFetch
    ),
    buildMetric(
      "chainops.reviewer_decision.duration",
      "Persisted reviewer timing derived from audit-event evidence.",
      "ms",
      analytics.operationalMetrics.reviewerDecision
    ),
    {
      name: "chainops.queue.visible_cases",
      description: "Current filtered queue counts carried alongside the local OpenTelemetry seam.",
      unit: "1",
      aggregationTemporality: "cumulative",
      dataPoints: [
        { attributes: { status: "pending_review" }, value: analytics.statusTransitions.enteredReviewCount },
        { attributes: { status: "approved" }, value: analytics.statusTransitions.approvedCount },
        { attributes: { status: "rejected" }, value: analytics.statusTransitions.rejectedCount },
        { attributes: { status: "ingestion_failed" }, value: analytics.statusTransitions.failedIngestionCount }
      ]
    }
  ];
}

function buildMetric(
  name: string,
  description: string,
  unit: "ms",
  summary: CaseQueueAnalytics["operationalMetrics"]["intakePipeline"]
): OpenTelemetryExportSnapshot["metrics"][number] {
  return {
    name,
    description,
    unit,
    aggregationTemporality: "cumulative",
    dataPoints: [
      { attributes: { statistic: "average" }, value: summary.averageDurationMs ?? 0 },
      { attributes: { statistic: "max" }, value: summary.maxDurationMs ?? 0 },
      { attributes: { statistic: "completed_count" }, value: summary.completedCount },
      { attributes: { statistic: "failed_count" }, value: summary.failedCount }
    ]
  };
}

function findLastAuditEvent(auditEvents: AuditEvent[], type: AuditEvent["type"]): AuditEvent | undefined {
  return [...auditEvents].reverse().find((event) => event.type === type);
}

function readEventDuration(details: Record<string, unknown> | undefined, key: string): number | null {
  const value = details?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildTraceHex(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function buildSpanHex(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}
