import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../src/server.ts";
import { JsonAuditStore } from "../src/store.ts";

test("creates a case, writes audit events, and records human approval", async (t) => {
  const baseDir = await mkdtemp(join(tmpdir(), "chainops-"));
  const store = new JsonAuditStore(join(baseDir, "audit-log.json"));
  const app = createApp(store);

  await new Promise<void>((resolve) => app.listen(0, resolve));
  t.after(() => app.close());

  const address = app.address();
  assert.equal(typeof address, "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const createResponse = await fetch(`${baseUrl}/cases`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": "trace-test-1"
    },
    body: JSON.stringify({ walletAddress: "0x1111111111111111111111111111111111111111" })
  });

  assert.equal(createResponse.status, 201);
  assert.equal(createResponse.headers.get("x-trace-id"), "trace-test-1");

  const created = await createResponse.json();
  assert.equal(created.caseRecord.status, "pending_review");
  assert.equal(created.caseRecord.risk.level, "high");
  assert.equal(created.auditEvents.length, 5);
  assert.deepEqual(
    created.auditEvents.map((event) => event.type),
    [
      "CASE_RECEIVED",
      "WALLET_VALIDATED",
      "TRANSACTIONS_INGESTED",
      "RISK_EVALUATED",
      "HUMAN_REVIEW_PENDING"
    ]
  );

  const approvalResponse = await fetch(`${baseUrl}/cases/${created.caseRecord.id}/approval`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ decision: "approve", note: "fixture reviewed" })
  });

  assert.equal(approvalResponse.status, 200);
  const approved = await approvalResponse.json();
  assert.equal(approved.caseRecord.status, "approved");
  assert.equal(approved.auditEvent.type, "HUMAN_APPROVED");

  const readResponse = await fetch(`${baseUrl}/cases/${created.caseRecord.id}`);
  assert.equal(readResponse.status, 200);
  const found = await readResponse.json();
  assert.equal(found.auditEvents.length, 6);
});

test("returns a validation failure without creating a case", async (t) => {
  const baseDir = await mkdtemp(join(tmpdir(), "chainops-"));
  const store = new JsonAuditStore(join(baseDir, "audit-log.json"));
  const app = createApp(store);

  await new Promise<void>((resolve) => app.listen(0, resolve));
  t.after(() => app.close());

  const address = app.address();
  assert.equal(typeof address, "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const response = await fetch(`${baseUrl}/cases`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ walletAddress: "bad" })
  });

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.error, /0x-prefixed 40-byte hex address/);

  const readiness = await fetch(`${baseUrl}/ready`);
  const readinessBody = await readiness.json();
  assert.equal(readinessBody.store.caseCount, 0);
  assert.equal(readinessBody.store.auditEventCount, 0);
});
