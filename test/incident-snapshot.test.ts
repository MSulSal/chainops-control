import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCaseIncidentSnapshot,
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
