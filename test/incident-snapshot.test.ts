import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCaseIncidentSnapshot,
  buildReleaseRecordSnapshot,
  buildWorkspaceIncidentSnapshot
} from "../src/incident-snapshot.ts";

test("builds a workspace incident snapshot from filtered queue state", () => {
  const snapshot = buildWorkspaceIncidentSnapshot({
    generatedAt: "2026-07-01T18:30:00.000Z",
    filters: {
      limit: 20,
      status: "pending_review",
      riskLevel: "high",
      search: "trace-123"
    },
    summary: {
      total: 1,
      pendingReviewCount: 1,
      failedIngestionCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      highRiskCount: 1,
      mediumRiskCount: 0,
      lowRiskCount: 0
    },
    analytics: {
      statusTransitions: {
        enteredReviewCount: 1,
        approvedCount: 0,
        rejectedCount: 0,
        failedIngestionCount: 0
      },
      reviewLatency: {
        reviewedCount: 0,
        averageHours: null,
        maxHours: null,
        oldestPendingHours: 2
      },
      operationalMetrics: {
        intakePipeline: {
          completedCount: 1,
          failedCount: 0,
          averageDurationMs: 180,
          maxDurationMs: 180
        },
        providerFetch: {
          completedCount: 1,
          failedCount: 0,
          averageDurationMs: 140,
          maxDurationMs: 140
        },
        reviewerDecision: {
          completedCount: 0,
          failedCount: 0,
          averageDurationMs: null,
          maxDurationMs: null
        }
      },
      timeline: []
    },
    cases: [
      {
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
          fetchedAt: "2026-07-01T18:00:00.000Z",
          attemptCount: 1,
          timeoutMs: 1500,
          transactionCount: 3
        },
        traceId: "trace-123",
        createdAt: "2026-07-01T18:00:00.000Z"
      }
    ]
  });

  assert.equal(snapshot.scope, "workspace");
  assert.equal(snapshot.releaseGuide.statusLabel, "Ready");
  assert.equal(snapshot.visibleCases[0].traceId, "trace-123");
  assert.match(snapshot.visibleCases[0].summary, /trace trace-123/);
});

test("builds a case incident snapshot with trace-backed guide and stage evidence", () => {
  const snapshot = buildCaseIncidentSnapshot({
    generatedAt: "2026-07-01T18:30:00.000Z",
    caseRecord: {
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
        fetchedAt: "2026-07-01T18:05:00.000Z",
        attemptCount: 1,
        timeoutMs: 1500,
        transactionCount: 0,
        errorCode: "timeout",
        retriable: true
      },
      traceId: "trace-timeout-1",
      createdAt: "2026-07-01T18:05:00.000Z"
    },
    auditEvents: [
      {
        id: "audit-1",
        caseId: "case-2",
        type: "PROVIDER_FETCH_FAILED",
        traceId: "trace-timeout-1",
        at: "2026-07-01T18:05:00.000Z",
        details: {
          provider: "etherscan-account-txlist",
          errorCode: "timeout",
          durationMs: 1550,
          intakeDurationMs: 1620
        }
      }
    ],
    releaseRecord: {
      generatedAt: "2026-07-01T18:25:00.000Z",
      scope: "release_record",
      filters: { limit: 20 },
      release: {
        version: "0.1.0",
        channel: "local_container_runtime",
        statusLabel: "Hold",
        summary: "The current queue contains persisted ingestion or intake failures, so the next release should pause until the failure pattern is understood.",
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
          expectedTraceIds: []
        },
        seededReplay: {
          actionPathTemplate: "/cases/:id/replay",
          expectedOutcome: "Replay the seeded failed-ingestion case."
        },
        hostReadiness: {
          artifactPath: "/exports/host-readiness",
          failureMode: "blocked until prerequisites are ready",
          lastResult: {
            generatedAt: "2026-07-01T18:20:00.000Z",
            scope: "host_readiness",
            overall: {
              statusLabel: "Blocked",
              summary: "Terraform CLI is unavailable on this host."
            },
            runtime: {
              dockerComposeFile: "docker-compose.yml",
              terraformSandboxPath: "infra/terraform/sandbox",
              reviewerWorkspacePath: "/",
              apiBaseUrl: "http://127.0.0.1:4317"
            },
            checks: [],
            providerSandbox: {
              status: "blocked",
              summary: "The first provider-backed sandbox attempt should stay paused on this host.",
              missingRequirements: ["Terraform CLI is unavailable on this host."],
              nextSteps: ["Install Terraform and rerun host readiness."]
            },
            boundaries: ["Local host readiness only."]
          }
        },
        runtimeParity: {
          comparedExports: [],
          ignoredFields: [],
          failureMode: "treat runtime as stale on drift",
          lastResult: {
            checkedAt: "2026-07-01T18:15:00.000Z",
            baseUrl: "http://127.0.0.1:4317",
            status: "failed",
            summary: "The running service failed the seeded runtime parity gate and should be treated as stale.",
            comparedExports: ["/exports/releases/latest"],
            ignoredFields: ["generatedAt"],
            exportChecks: []
          },
          reviewArtifact: null,
          focusCaseReplayArtifact: {
            fileName: "focus-case-incident-snapshot.json",
            captureStatus: "captured",
            replayStatus: "failed_again",
            summary: "runtime-parity-evidence captured focus-case-incident-snapshot.json successfully for remote replay review (latest replay status: failed again).",
            artifactHint: "Look for focus-case-incident-snapshot.json inside the runtime-parity-evidence bundle before rerunning the live smoke path."
          }
        }
      },
      evidence: {
        summary: {
          total: 1,
          pendingReviewCount: 0,
          failedIngestionCount: 1,
          approvedCount: 0,
          rejectedCount: 0,
          highRiskCount: 0,
          mediumRiskCount: 0,
          lowRiskCount: 1
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
              completedCount: 0,
              failedCount: 1,
              averageDurationMs: null,
              maxDurationMs: 1620
            },
            providerFetch: {
              completedCount: 0,
              failedCount: 1,
              averageDurationMs: null,
              maxDurationMs: 1550
            },
            reviewerDecision: {
              completedCount: 0,
              failedCount: 0,
              averageDurationMs: null,
              maxDurationMs: null
            }
          },
          timeline: []
        },
        releaseGuide: {
          title: "Investigate before release",
          tone: "danger",
          statusLabel: "Hold",
          summary: "The current queue contains persisted ingestion failures.",
          releaseDecision: "Keep the current build out of wider rollout.",
          rollbackDecision: "Rollback if this aligns with a recent provider or runtime change.",
          actions: [],
          evidence: []
        },
        telemetryHandoffPath: "/exports/telemetry",
        workspaceSnapshotPath: "/exports/workspace",
        focusCasePath: "/cases/case-2",
        focusCaseExportPath: "/exports/cases/case-2",
        focusTraceId: "trace-timeout-1",
        replay: {
          status: "failed_again",
          summary: "Replay attempt 1 reused the original idempotency key, but the latest provider fetch still ended in timeout.",
          replayAttempt: 1,
          casePath: "/cases/case-2",
          caseExportPath: "/exports/cases/case-2",
          traceId: "trace-timeout-1",
          history: [
            {
              attempt: 1,
              status: "failed_again",
              at: "2026-07-01T18:10:00.000Z",
              traceId: "trace-replay-failed-1",
              summary: "Replay attempt 1 repeated the failure through the same API path with timeout."
            }
          ]
        }
      },
      rollback: {
        decision: "Rollback if this aligns with a recent provider or runtime change.",
        triggers: [],
        evidence: []
      },
      boundaries: []
    }
  });

  assert.equal(snapshot.scope, "case");
  assert.equal(snapshot.incidentGuide.statusLabel, "Incident");
  assert.equal(snapshot.stageTrace[1].statusLabel, "Failed");
  assert.match(snapshot.providerSummary, /error timeout/);
  assert.equal(snapshot.releaseHandoff.releaseStatusLabel, "Hold");
  assert.equal(snapshot.releaseHandoff.focusCase.isCurrentFocusCase, true);
  assert.equal(snapshot.releaseHandoff.runtimeParity.status, "failed");
  assert.equal(snapshot.releaseHandoff.replay.status, "failed_again");
  assert.equal(snapshot.releaseHandoff.hostReadiness.statusLabel, "Blocked");
});

test("builds replay history in the release record evidence", () => {
  const snapshot = buildReleaseRecordSnapshot({
    generatedAt: "2026-07-08T18:30:00.000Z",
    filters: {
      limit: 20
    },
    summary: {
      total: 1,
      pendingReviewCount: 1,
      failedIngestionCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      highRiskCount: 0,
      mediumRiskCount: 1,
      lowRiskCount: 0
    },
    analytics: {
      statusTransitions: {
        enteredReviewCount: 1,
        approvedCount: 0,
        rejectedCount: 0,
        failedIngestionCount: 1
      },
      reviewLatency: {
        reviewedCount: 0,
        averageHours: null,
        maxHours: null,
        oldestPendingHours: 1.5
      },
      operationalMetrics: {
        intakePipeline: {
          completedCount: 1,
          failedCount: 1,
          averageDurationMs: 400,
          maxDurationMs: 800
        },
        providerFetch: {
          completedCount: 1,
          failedCount: 1,
          averageDurationMs: 300,
          maxDurationMs: 600
        },
        reviewerDecision: {
          completedCount: 0,
          failedCount: 0,
          averageDurationMs: null,
          maxDurationMs: null
        }
      },
      timeline: []
    },
    cases: [
      {
        id: "case-replay-1",
        walletAddress: "0x1111111111111111111111111111111111111111",
        status: "pending_review",
        risk: {
          level: "medium",
          score: 30,
          indicators: ["sampled transfer volume is at or above 25 ETH"]
        },
        sourceMetadata: {
          provider: "deterministic-fixture",
          mode: "fixture",
          network: "ethereum-mainnet",
          fetchedAt: "2026-07-08T18:05:00.000Z",
          attemptCount: 1,
          timeoutMs: 1500,
          transactionCount: 3
        },
        traceId: "trace-demo-replay-recovered-2",
        createdAt: "2026-07-08T18:00:00.000Z"
      }
    ],
    caseDetails: [
      {
        caseRecord: {
          id: "case-replay-1",
          walletAddress: "0x1111111111111111111111111111111111111111",
          status: "pending_review",
          risk: {
            level: "medium",
            score: 30,
            indicators: ["sampled transfer volume is at or above 25 ETH"]
          },
          transactions: [],
          sourceMetadata: {
            provider: "deterministic-fixture",
            mode: "fixture",
            network: "ethereum-mainnet",
            fetchedAt: "2026-07-08T18:05:00.000Z",
            attemptCount: 1,
            timeoutMs: 1500,
            transactionCount: 3
          },
          traceId: "trace-demo-replay-recovered-2",
          createdAt: "2026-07-08T18:00:00.000Z"
        },
        auditEvents: [
          {
            id: "audit-replay-failed-1",
            caseId: "case-replay-1",
            type: "FAILED_CASE_REPLAY_FAILED",
            traceId: "trace-demo-replay-failed-1",
            at: "2026-07-08T18:02:00.000Z",
            details: {
              replayAttempt: 1,
              errorCode: "timeout"
            }
          },
          {
            id: "audit-replay-recovered-2",
            caseId: "case-replay-1",
            type: "FAILED_CASE_REPLAY_RECOVERED",
            traceId: "trace-demo-replay-recovered-2",
            at: "2026-07-08T18:05:00.000Z",
            details: {
              replayAttempt: 2
            }
          }
        ]
      }
    ]
  });

  assert.equal(snapshot.evidence.replay.status, "recovered");
  assert.equal(snapshot.evidence.replay.replayAttempt, 2);
  assert.equal(snapshot.evidence.replay.history.length, 2);
  assert.equal(snapshot.evidence.replay.history[0]?.status, "failed_again");
  assert.equal(snapshot.evidence.replay.history[0]?.traceId, "trace-demo-replay-failed-1");
  assert.equal(snapshot.evidence.replay.history[1]?.status, "recovered");
  assert.equal(snapshot.evidence.replay.history[1]?.traceId, "trace-demo-replay-recovered-2");
});
