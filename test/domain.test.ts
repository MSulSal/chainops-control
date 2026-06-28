import assert from "node:assert/strict";
import test from "node:test";
import { buildTransactionSample, evaluateRisk, normalizeWalletAddress } from "../src/domain.ts";

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

test("computes deterministic high risk for flagged wallet fixtures", () => {
  const wallet = "0x1111111111111111111111111111111111111111";
  const transactions = buildTransactionSample(wallet);
  const risk = evaluateRisk(wallet, transactions);

  assert.equal(risk.level, "high");
  assert.ok(risk.indicators.some((indicator) => indicator.includes("watchlist")));
});
