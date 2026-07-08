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
    ]
  });

  assert.equal(snapshot.scope, "case");
  assert.equal(snapshot.incidentGuide.statusLabel, "Incident");
  assert.equal(snapshot.stageTrace[1].statusLabel, "Failed");
  assert.match(snapshot.providerSummary, /error timeout/);
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
