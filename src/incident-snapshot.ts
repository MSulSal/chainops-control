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
  getCaseStageTrace,
  getCaseListSubtitle,
  getProviderSummary,
  getWorkspaceOperationalGuide
} from "./reviewer-view.ts";

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
      releaseRecordPath: string;
    };
    seededScenario: {
      name: string;
      expectedTraceIds: string[];
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
}): ReleaseRecordSnapshot {
  const releaseGuide = getWorkspaceOperationalGuide(input.summary, input.analytics);
  const focusCase =
    input.cases.find((caseItem) => caseItem.status === "ingestion_failed") ??
    input.cases.find((caseItem) => caseItem.status === "pending_review") ??
    input.cases[0];

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
        releaseRecordPath: "/exports/releases/latest"
      },
      seededScenario: {
        name: "incident_review_v1",
        expectedTraceIds: [
          "trace-demo-provider-timeout",
          "trace-demo-pending-high",
          "trace-demo-approved-low"
        ]
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
      focusTraceId: focusCase?.traceId ?? null
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
