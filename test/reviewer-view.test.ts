import assert from "node:assert/strict";
import test from "node:test";
import {
  getActiveFilterChips,
  getCaseOperationalGuide,
  getCaseReleaseRecordSummary,
  getCaseStageTrace,
  getQueueAnalyticsCards,
  getCaseDetailCallout,
  getCaseListSubtitle,
  getOperationalMetricCards,
  getProviderSummary,
  getReviewArtifactCaptureSummary,
  getReviewArtifactExpectedFiles,
  getReviewArtifactFocusCaseArtifactHint,
  getReviewArtifactReplayCaptureSummary,
  getReviewLatencyCards,
  getTimelineBars,
  getQueueSummaryCards,
  getStatusCopy,
  getWorkspaceOperationalGuide
} from "../src/reviewer-view.ts";

test("builds reviewer list copy for a healthy pending-review case", () => {
  const status = getStatusCopy("pending_review");
  const summary = getCaseListSubtitle({
    id: "case-1",
    walletAddress: "0x1111111111111111111111111111111111111111",
    status: "pending_review",
    risk: {
      level: "high",
      score: 80,
      indicators: ["fixture watchlist hit"]
    },
    sourceMetadata: {
      provider: "etherscan-account-txlist",
      mode: "live",
      network: "ethereum-mainnet",
      fetchedAt: "2026-06-29T18:00:00.000Z",
      attemptCount: 1,
      timeoutMs: 1500,
      transactionCount: 3
    },
    traceId: "trace-123",
    createdAt: "2026-06-29T18:00:00.000Z"
  });

  assert.equal(status.label, "Pending review");
  assert.match(summary, /etherscan-account-txlist/);
  assert.match(summary, /trace trace-123/);
});

test("surfaces retry-safe failed-ingestion guidance in the detail view", () => {
  const callout = getCaseDetailCallout(
    {
      id: "case-2",
      walletAddress: "0x1111111111111111111111111111111111111111",
      status: "ingestion_failed",
      risk: {
        level: "low",
        score: 0,
        indicators: ["transaction sample unavailable until provider retry succeeds"]
      },
      transactions: [],
      sourceMetadata: {
        provider: "etherscan-account-txlist",
        mode: "live",
        network: "ethereum-mainnet",
        fetchedAt: "2026-06-29T18:05:00.000Z",
        attemptCount: 2,
        timeoutMs: 1500,
        transactionCount: 0,
        errorCode: "timeout",
        retriable: true
      },
      traceId: "trace-timeout-1",
      createdAt: "2026-06-29T18:05:00.000Z"
    },
    [
      {
        id: "audit-1",
        caseId: "case-2",
        type: "PROVIDER_FETCH_FAILED",
        traceId: "trace-timeout-1",
        at: "2026-06-29T18:05:00.000Z",
        details: {
          errorCode: "timeout"
        }
      }
    ]
  );

  assert.match(getProviderSummary({
    provider: "etherscan-account-txlist",
    mode: "live",
    network: "ethereum-mainnet",
    fetchedAt: "2026-06-29T18:05:00.000Z",
    attemptCount: 2,
    timeoutMs: 1500,
    transactionCount: 0,
    errorCode: "timeout",
    retriable: true
  }), /error timeout/);
  assert.ok(callout);
  assert.match(callout, /same idempotency key/);
});

test("surfaces replay recovery evidence on a recovered case detail view", () => {
  const callout = getCaseDetailCallout(
    {
      id: "case-recovered-1",
      walletAddress: "0x1111111111111111111111111111111111111111",
      status: "pending_review",
      risk: {
        level: "medium",
        score: 30,
        indicators: ["sampled transfer volume is at or above 25 ETH"]
      },
      transactions: [],
      sourceMetadata: {
        provider: "etherscan-account-txlist",
        mode: "live",
        network: "ethereum-mainnet",
        fetchedAt: "2026-07-07T18:05:00.000Z",
        attemptCount: 2,
        timeoutMs: 1500,
        transactionCount: 3
      },
      traceId: "trace-recovered-1",
      createdAt: "2026-07-07T18:00:00.000Z"
    },
    [
      {
        id: "audit-replay-recovered-1",
        caseId: "case-recovered-1",
        type: "FAILED_CASE_REPLAY_RECOVERED",
        traceId: "trace-recovered-1",
        at: "2026-07-07T18:05:00.000Z",
        details: {
          replayAttempt: 1
        }
      }
    ]
  );

  assert.ok(callout);
  assert.match(callout, /replay attempt 1/i);
  assert.match(callout, /recovered this case/i);
});

test("builds summary cards and active filter chips for the reviewer workspace", () => {
  const cards = getQueueSummaryCards({
    total: 9,
    pendingReviewCount: 4,
    failedIngestionCount: 2,
    approvedCount: 2,
    rejectedCount: 1,
    highRiskCount: 3,
    mediumRiskCount: 4,
    lowRiskCount: 2
  });
  const chips = getActiveFilterChips({
    limit: 50,
    status: "pending_review",
    riskLevel: "high",
    search: "trace-123"
  });

  assert.equal(cards[0].label, "Visible queue");
  assert.equal(cards[1].value, "4");
  assert.deepEqual(chips, ["status:pending_review", "risk:high", "query:trace-123"]);
});

test("builds analytics cards and timeline bars for persisted reviewer metrics", () => {
  const analytics = {
    statusTransitions: {
      enteredReviewCount: 5,
      approvedCount: 2,
      rejectedCount: 1,
      failedIngestionCount: 1
    },
    reviewLatency: {
      reviewedCount: 3,
      averageHours: 2.5,
      maxHours: 5.25,
      oldestPendingHours: 27.4
    },
    operationalMetrics: {
      intakePipeline: {
        completedCount: 4,
        failedCount: 1,
        averageDurationMs: 180,
        maxDurationMs: 320
      },
      providerFetch: {
        completedCount: 4,
        failedCount: 1,
        averageDurationMs: 160,
        maxDurationMs: 300
      },
      reviewerDecision: {
        completedCount: 3,
        failedCount: 0,
        averageDurationMs: 95,
        maxDurationMs: 120
      }
    },
    timeline: [
      {
        day: "2026-06-29",
        createdCount: 2,
        reviewedCount: 1,
        approvedCount: 1,
        rejectedCount: 0,
        failedIngestionCount: 1
      },
      {
        day: "2026-06-30",
        createdCount: 4,
        reviewedCount: 3,
        approvedCount: 2,
        rejectedCount: 1,
        failedIngestionCount: 0
      }
    ]
  };
  const analyticsCards = getQueueAnalyticsCards(analytics);
  const latencyCards = getReviewLatencyCards(analytics);
  const operationalCards = getOperationalMetricCards(analytics);
  const timelineBars = getTimelineBars(analytics.timeline);

  assert.equal(analyticsCards[0].value, "5");
  assert.equal(latencyCards[1].value, "2.5");
  assert.equal(latencyCards[3].tone, "danger");
  assert.equal(operationalCards[0].value, "180 ms");
  assert.match(operationalCards[1].description, /1 failed/);
  assert.equal(timelineBars[0].dayLabel, "Jun 29");
  assert.equal(timelineBars[1].reviewedCount, 3);
});

test("builds request-stage trace cards from persisted audit events", () => {
  const stages = getCaseStageTrace(
    {
      id: "case-3",
      walletAddress: "0x1111111111111111111111111111111111111111",
      status: "approved",
      risk: {
        level: "high",
        score: 80,
        indicators: ["fixture watchlist hit"]
      },
      transactions: [],
      sourceMetadata: {
        provider: "etherscan-account-txlist",
        mode: "live",
        network: "ethereum-mainnet",
        fetchedAt: "2026-06-30T18:00:00.000Z",
        attemptCount: 1,
        timeoutMs: 1500,
        transactionCount: 3
      },
      traceId: "trace-operational-1",
      createdAt: "2026-06-30T18:00:00.000Z",
      reviewedAt: "2026-06-30T18:05:00.000Z",
      reviewerNote: "Approved after reviewing fixture evidence."
    },
    [
      {
        id: "audit-1",
        caseId: "case-3",
        type: "TRANSACTIONS_INGESTED",
        traceId: "trace-operational-1",
        at: "2026-06-30T18:00:00.000Z",
        details: {
          source: "etherscan-account-txlist",
          count: 3,
          durationMs: 144
        }
      },
      {
        id: "audit-2",
        caseId: "case-3",
        type: "HUMAN_REVIEW_PENDING",
        traceId: "trace-operational-1",
        at: "2026-06-30T18:00:00.000Z",
        details: {
          requiredBeforeAction: true,
          durationMs: 188
        }
      },
      {
        id: "audit-3",
        caseId: "case-3",
        type: "HUMAN_APPROVED",
        traceId: "trace-operational-1",
        at: "2026-06-30T18:05:00.000Z",
        details: {
          note: "Approved after reviewing fixture evidence.",
          durationMs: 74
        }
      }
    ]
  );

  assert.equal(stages[0].duration, "188 ms");
  assert.equal(stages[1].statusLabel, "Completed");
  assert.match(stages[1].detail, /3 transaction samples/);
  assert.equal(stages[2].duration, "74 ms");
});

test("holds release guidance when queue analytics show persisted failures", () => {
  const guide = getWorkspaceOperationalGuide(
    {
      total: 4,
      pendingReviewCount: 2,
      failedIngestionCount: 1,
      approvedCount: 1,
      rejectedCount: 0,
      highRiskCount: 2,
      mediumRiskCount: 1,
      lowRiskCount: 1
    },
    {
      statusTransitions: {
        enteredReviewCount: 2,
        approvedCount: 1,
        rejectedCount: 0,
        failedIngestionCount: 1
      },
      reviewLatency: {
        reviewedCount: 1,
        averageHours: 1.5,
        maxHours: 1.5,
        oldestPendingHours: 2
      },
      operationalMetrics: {
        intakePipeline: {
          completedCount: 2,
          failedCount: 1,
          averageDurationMs: 180,
          maxDurationMs: 280
        },
        providerFetch: {
          completedCount: 2,
          failedCount: 1,
          averageDurationMs: 220,
          maxDurationMs: 440
        },
        reviewerDecision: {
          completedCount: 1,
          failedCount: 0,
          averageDurationMs: 95,
          maxDurationMs: 95
        }
      },
      timeline: []
    }
  );

  assert.equal(guide.statusLabel, "Hold");
  assert.equal(guide.tone, "danger");
  assert.match(guide.rollbackDecision, /roll back/i);
  assert.match(guide.evidence[0], /1 failed-ingestion/);
});

test("builds retry-safe incident guidance for a failed case", () => {
  const guide = getCaseOperationalGuide(
    {
      id: "case-4",
      walletAddress: "0x1111111111111111111111111111111111111111",
      status: "ingestion_failed",
      risk: {
        level: "low",
        score: 0,
        indicators: ["transaction sample unavailable until provider retry succeeds"]
      },
      transactions: [],
      sourceMetadata: {
        provider: "etherscan-account-txlist",
        mode: "live",
        network: "ethereum-mainnet",
        fetchedAt: "2026-07-01T10:00:00.000Z",
        attemptCount: 1,
        timeoutMs: 1500,
        transactionCount: 0,
        errorCode: "timeout",
        retriable: true
      },
      traceId: "trace-failed-1",
      createdAt: "2026-07-01T10:00:00.000Z"
    },
    [
      {
        id: "audit-1",
        caseId: "case-4",
        type: "PROVIDER_FETCH_FAILED",
        traceId: "trace-failed-1",
        at: "2026-07-01T10:00:00.000Z",
        details: {
          provider: "etherscan-account-txlist",
          errorCode: "timeout",
          durationMs: 1550,
          intakeDurationMs: 1630
        }
      }
    ]
  );

  assert.equal(guide.statusLabel, "Incident");
  assert.equal(guide.tone, "danger");
  assert.match(guide.actions[1], /same Idempotency-Key/);
  assert.match(guide.evidence[1], /timeout/);
});

test("records repeated replay failure evidence in the incident guide", () => {
  const guide = getCaseOperationalGuide(
    {
      id: "case-4b",
      walletAddress: "0x1111111111111111111111111111111111111111",
      status: "ingestion_failed",
      risk: {
        level: "low",
        score: 0,
        indicators: ["transaction sample unavailable until provider retry succeeds"]
      },
      transactions: [],
      sourceMetadata: {
        provider: "etherscan-account-txlist",
        mode: "live",
        network: "ethereum-mainnet",
        fetchedAt: "2026-07-07T19:00:00.000Z",
        attemptCount: 2,
        timeoutMs: 1500,
        transactionCount: 0,
        errorCode: "timeout",
        retriable: true
      },
      traceId: "trace-failed-2",
      createdAt: "2026-07-07T19:00:00.000Z"
    },
    [
      {
        id: "audit-1",
        caseId: "case-4b",
        type: "PROVIDER_FETCH_FAILED",
        traceId: "trace-failed-2",
        at: "2026-07-07T19:00:00.000Z",
        details: {
          provider: "etherscan-account-txlist",
          errorCode: "timeout",
          durationMs: 1550,
          intakeDurationMs: 1630
        }
      },
      {
        id: "audit-2",
        caseId: "case-4b",
        type: "FAILED_CASE_REPLAY_FAILED",
        traceId: "trace-failed-2",
        at: "2026-07-07T19:05:00.000Z",
        details: {
          replayAttempt: 2
        }
      }
    ]
  );

  assert.match(guide.evidence.at(-1) ?? "", /replay attempt 2/i);
  assert.match(guide.evidence.at(-1) ?? "", /repeated the failure/i);
});

test("marks the current case as the release-record focus when paths match", () => {
  const summary = getCaseReleaseRecordSummary(
    {
      id: "case-4",
      walletAddress: "0x1111111111111111111111111111111111111111",
      status: "ingestion_failed",
      risk: {
        level: "low",
        score: 0,
        indicators: ["transaction sample unavailable until provider retry succeeds"]
      },
      transactions: [],
      sourceMetadata: {
        provider: "etherscan-account-txlist",
        mode: "live",
        network: "ethereum-mainnet",
        fetchedAt: "2026-07-01T10:00:00.000Z",
        attemptCount: 1,
        timeoutMs: 1500,
        transactionCount: 0,
        errorCode: "timeout",
        retriable: true
      },
      traceId: "trace-failed-1",
      createdAt: "2026-07-01T10:00:00.000Z"
    },
    {
      generatedAt: "2026-07-06T18:00:00.000Z",
      scope: "release_record",
      filters: { limit: 20 },
      release: {
        version: "0.1.0",
        channel: "local_container_runtime",
        statusLabel: "Hold",
        summary: "Runtime parity failed for the current release candidate.",
        containerImages: {
          api: "local Dockerfile build via docker compose service api",
          postgres: "postgres:16-alpine"
        },
        reviewerWorkspacePath: "/"
      },
      verification: {
        requiredCommands: [],
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
          expectedTraceIds: ["trace-demo-provider-timeout"]
        },
        hostReadiness: {
          artifactPath: "/exports/host-readiness",
          failureMode: "Treat the first provider-backed sandbox attempt as blocked.",
          lastResult: null
        },
        runtimeParity: {
          comparedExports: ["/exports/releases/latest"],
          ignoredFields: ["generatedAt"],
          failureMode: "Treat the runtime as stale.",
          lastResult: null,
          reviewArtifact: null
        }
      },
      evidence: {
        summary: {
          total: 1,
          pendingReviewCount: 0,
          approvedCount: 0,
          rejectedCount: 0,
          failedIngestionCount: 1,
          highRiskCount: 1,
          mediumRiskCount: 0,
          lowRiskCount: 0
        },
        analytics: {
          statusTransitions: {
            enteredReviewCount: 0,
            approvedCount: 0,
            rejectedCount: 0,
            failedIngestionCount: 1
          },
          reviewLatency: {
            reviewedCount: 0,
            averageHours: null,
            maxHours: null,
            oldestPendingHours: null
          },
          operationalMetrics: {
            intakePipeline: {
              averageDurationMs: null,
              maxDurationMs: null,
              completedCount: 0,
              failedCount: 1
            },
            providerFetch: {
              averageDurationMs: null,
              maxDurationMs: null,
              completedCount: 0,
              failedCount: 1
            },
            reviewerDecision: {
              averageDurationMs: null,
              maxDurationMs: null,
              completedCount: 0,
              failedCount: 0
            }
          },
          timeline: []
        },
        releaseGuide: {
          title: "Hold release",
          tone: "danger",
          statusLabel: "Hold",
          summary: "Runtime drift needs review.",
          releaseDecision: "Do not treat this release as current.",
          rollbackDecision: "Roll back after comparing the stale runtime evidence.",
          actions: ["Review the failed export path."],
          evidence: ["OpenTelemetry export was missing."]
        },
        telemetryHandoffPath: "/exports/telemetry",
        workspaceSnapshotPath: "/exports/workspace",
        focusCasePath: "/cases/case-4",
        focusCaseExportPath: "/exports/cases/case-4",
        focusTraceId: "trace-failed-1"
      },
      rollback: {
        decision: "Roll back after comparing the stale runtime evidence.",
        triggers: ["Missing required export."],
        evidence: ["Focus case case-4 / trace trace-failed-1."]
      },
      boundaries: ["Local runtime contract only."]
    }
  );

  assert.equal(summary.tone, "danger");
  assert.equal(summary.focusCasePath, "/cases/case-4");
  assert.match(summary.summary, /rollback drill anchor/i);
});

test("points case detail users back to the release focus case when another case anchors the record", () => {
  const summary = getCaseReleaseRecordSummary(
    {
      id: "case-9",
      walletAddress: "0x9999999999999999999999999999999999999999",
      status: "approved",
      risk: {
        level: "medium",
        score: 45,
        indicators: ["fixture comparison case"]
      },
      transactions: [],
      sourceMetadata: {
        provider: "deterministic-fixture",
        mode: "fixture",
        network: "ethereum-mainnet",
        fetchedAt: "2026-07-01T10:00:00.000Z",
        attemptCount: 1,
        timeoutMs: 1500,
        transactionCount: 3
      },
      traceId: "trace-comparison-1",
      createdAt: "2026-07-01T10:00:00.000Z",
      reviewedAt: "2026-07-01T10:05:00.000Z",
      reviewerNote: "Comparison evidence."
    },
    {
      generatedAt: "2026-07-06T18:00:00.000Z",
      scope: "release_record",
      filters: { limit: 20 },
      release: {
        version: "0.1.0",
        channel: "local_container_runtime",
        statusLabel: "Ready",
        summary: "The queue is ready for a controlled release.",
        containerImages: {
          api: "local Dockerfile build via docker compose service api",
          postgres: "postgres:16-alpine"
        },
        reviewerWorkspacePath: "/"
      },
      verification: {
        requiredCommands: [],
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
          expectedTraceIds: ["trace-demo-approved-low"]
        },
        hostReadiness: {
          artifactPath: "/exports/host-readiness",
          failureMode: "Treat the first provider-backed sandbox attempt as blocked.",
          lastResult: null
        },
        runtimeParity: {
          comparedExports: ["/exports/releases/latest"],
          ignoredFields: ["generatedAt"],
          failureMode: "Treat the runtime as stale.",
          lastResult: null,
          reviewArtifact: null
        }
      },
      evidence: {
        summary: {
          total: 2,
          pendingReviewCount: 0,
          approvedCount: 2,
          rejectedCount: 0,
          failedIngestionCount: 0,
          highRiskCount: 0,
          mediumRiskCount: 2,
          lowRiskCount: 0
        },
        analytics: {
          statusTransitions: {
            enteredReviewCount: 2,
            approvedCount: 2,
            rejectedCount: 0,
            failedIngestionCount: 0
          },
          reviewLatency: {
            reviewedCount: 2,
            averageHours: 1,
            maxHours: 1.2,
            oldestPendingHours: null
          },
          operationalMetrics: {
            intakePipeline: {
              averageDurationMs: 100,
              maxDurationMs: 120,
              completedCount: 2,
              failedCount: 0
            },
            providerFetch: {
              averageDurationMs: 120,
              maxDurationMs: 150,
              completedCount: 2,
              failedCount: 0
            },
            reviewerDecision: {
              averageDurationMs: 90,
              maxDurationMs: 100,
              completedCount: 2,
              failedCount: 0
            }
          },
          timeline: []
        },
        releaseGuide: {
          title: "Ready for a controlled release",
          tone: "success",
          statusLabel: "Ready",
          summary: "The filtered queue has no persisted ingestion failures.",
          releaseDecision: "Proceed with a narrow rollout.",
          rollbackDecision: "Keep rollback guidance documented.",
          actions: ["Spot-check one recent approved case."],
          evidence: ["2 visible cases in the filtered queue."]
        },
        telemetryHandoffPath: "/exports/telemetry",
        workspaceSnapshotPath: "/exports/workspace",
        focusCasePath: "/cases/case-1",
        focusCaseExportPath: "/exports/cases/case-1",
        focusTraceId: "trace-demo-approved-low"
      },
      rollback: {
        decision: "Keep rollback guidance documented.",
        triggers: ["Compare later regressions against the focus case."],
        evidence: ["Focus case case-1 / trace trace-demo-approved-low."]
      },
      boundaries: ["Local runtime contract only."]
    }
  );

  assert.equal(summary.tone, "warning");
  assert.equal(summary.focusCasePath, "/cases/case-1");
  assert.match(summary.focusCaseLabel, /latest focus case/i);
});

test("summarizes CI host-readiness capture and expected artifact files", () => {
  const reviewArtifact = {
    provider: "github_actions" as const,
    artifactName: "runtime-parity-evidence",
    artifactFiles: [
      "runtime-parity-latest.json",
      "latest-release-record.json",
      "host-readiness.json",
      "focus-case-incident-snapshot.json",
      "ci-evidence-summary.json",
      "README.md"
    ],
    reviewHint: "Download the runtime-parity-evidence artifact.",
    captures: {
      runtimeParity: {
        status: "captured" as const
      },
      releaseRecord: {
        status: "captured" as const
      },
      hostReadiness: {
        status: "captured" as const,
        statusLabel: "Watch"
      },
      focusCaseSnapshot: {
        status: "captured" as const,
        replayStatus: "recovered" as const
      }
    },
    run: {
      runUrl: "https://github.com/MSulSal/chainops-control/actions/runs/123456789"
    }
  };

  assert.match(getReviewArtifactCaptureSummary(reviewArtifact), /captured host-readiness successfully \(Watch\)/i);
  assert.match(getReviewArtifactReplayCaptureSummary(reviewArtifact), /captured focus-case-incident-snapshot\.json successfully/i);
  assert.match(getReviewArtifactReplayCaptureSummary(reviewArtifact), /latest replay status: recovered/i);
  assert.match(getReviewArtifactFocusCaseArtifactHint(reviewArtifact), /look for focus-case-incident-snapshot\.json/i);
  assert.equal(
    getReviewArtifactExpectedFiles(reviewArtifact),
    "runtime-parity-latest.json, latest-release-record.json, host-readiness.json, focus-case-incident-snapshot.json, ci-evidence-summary.json, README.md"
  );
  assert.match(
    getReviewArtifactCaptureSummary({
      ...reviewArtifact,
      captures: {
        ...reviewArtifact.captures,
        hostReadiness: {
          status: "unavailable"
        }
      }
    }),
    /did not capture host-readiness successfully/i
  );
  assert.match(
    getReviewArtifactReplayCaptureSummary({
      ...reviewArtifact,
      captures: {
        ...reviewArtifact.captures,
        focusCaseSnapshot: {
          status: "missing"
        }
      }
    }),
    /did not expose a focus-case incident export/i
  );
});
