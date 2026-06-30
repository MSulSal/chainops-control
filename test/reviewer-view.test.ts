import assert from "node:assert/strict";
import test from "node:test";
import {
  getActiveFilterChips,
  getCaseDetailCallout,
  getCaseListSubtitle,
  getProviderSummary,
  getQueueSummaryCards,
  getStatusCopy
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
