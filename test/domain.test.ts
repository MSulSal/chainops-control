import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTransactionSample,
  createFailedCaseRecord,
  evaluateRisk,
  normalizeReviewerNote,
  normalizeWalletAddress
} from "../src/domain.ts";

test("normalizes valid wallet addresses", () => {
  assert.equal(
    normalizeWalletAddress("  0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD  "),
    "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"
  );
});

test("rejects invalid wallet addresses", () => {
  assert.throws(
    () => normalizeWalletAddress("0xnot-a-wallet"),
    /0x-prefixed 40-byte hex address/
  );
});

test("normalizes and requires reviewer notes", () => {
  assert.equal(normalizeReviewerNote("  reviewed fixture evidence  "), "reviewed fixture evidence");
  assert.throws(() => normalizeReviewerNote("   "), /reviewer note is required/);
});

test("computes deterministic high risk for flagged wallet fixtures", () => {
  const wallet = "0x1111111111111111111111111111111111111111";
  const transactions = buildTransactionSample(wallet);
  const risk = evaluateRisk(wallet, transactions);

  assert.equal(risk.level, "high");
  assert.ok(risk.indicators.some((indicator) => indicator.includes("watchlist")));
});

test("builds a retryable ingestion-failed record when provider data is unavailable", () => {
  const failed = createFailedCaseRecord({
    walletAddress: "0x1111111111111111111111111111111111111111",
    sourceMetadata: {
      provider: "etherscan-account-txlist",
      mode: "live",
      network: "ethereum-mainnet",
      fetchedAt: "2026-06-29T15:00:00.000Z",
      attemptCount: 2,
      timeoutMs: 1500,
      transactionCount: 0,
      errorCode: "timeout",
      retriable: true
    },
    traceId: "trace-failed-1",
    now: "2026-06-29T15:00:00.000Z"
  });

  assert.equal(failed.caseRecord.status, "ingestion_failed");
  assert.equal(failed.auditEvents.at(-1)?.type, "PROVIDER_FETCH_FAILED");
});
