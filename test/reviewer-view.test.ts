import assert from "node:assert/strict";
import test from "node:test";
import {
  getActiveFilterChips,
  getCaseOperationalGuide,
  getCaseStageTrace,
  getQueueAnalyticsCards,
  getCaseDetailCallout,
  getCaseListSubtitle,
  getOperationalMetricCards,
  getProviderSummary,
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
