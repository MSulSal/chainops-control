import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { newDb } from "pg-mem";
import { createApp } from "../src/server.ts";
import {
  EtherscanTransactionProvider,
  type TransactionProvider
} from "../src/provider.ts";
import { PostgresAuditStore } from "../src/store.ts";

test("creates a case, writes audit events, and records human approval", async (t) => {
  const store = await createTestStore();
  const app = createApp(store);

  await new Promise<void>((resolve) => app.listen(0, resolve));
  t.after(async () => {
    await new Promise<void>((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
    await store.close();
  });

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
  const store = await createTestStore();
  const app = createApp(store);

  await new Promise<void>((resolve) => app.listen(0, resolve));
  t.after(async () => {
    await new Promise<void>((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
    await store.close();
  });

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

test("replays duplicate intake requests when the same idempotency key is supplied", async (t) => {
  const store = await createTestStore();
  const app = createApp(store);

  await new Promise<void>((resolve) => app.listen(0, resolve));
  t.after(async () => {
    await new Promise<void>((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
    await store.close();
  });

  const address = app.address();
  assert.equal(typeof address, "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const requestHeaders = {
    "content-type": "application/json",
    "idempotency-key": "wallet-1111"
  };

  const firstResponse = await fetch(`${baseUrl}/cases`, {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify({ walletAddress: "0x1111111111111111111111111111111111111111" })
  });
  const secondResponse = await fetch(`${baseUrl}/cases`, {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify({ walletAddress: "0x1111111111111111111111111111111111111111" })
  });

  assert.equal(firstResponse.status, 201);
  assert.equal(secondResponse.status, 200);

  const firstBody = await firstResponse.json();
  const secondBody = await secondResponse.json();

  assert.equal(secondBody.replayed, true);
  assert.equal(secondBody.caseRecord.id, firstBody.caseRecord.id);
  assert.equal(secondBody.auditEvents.length, firstBody.auditEvents.length);

  const readiness = await fetch(`${baseUrl}/ready`);
  const readinessBody = await readiness.json();
  assert.equal(readinessBody.store.caseCount, 1);
  assert.equal(readinessBody.store.auditEventCount, 5);
});

test("persists provider timeout failures for review-safe retry handling", async (t) => {
  const provider = new EtherscanTransactionProvider({
    baseUrl: "https://example.test/api",
    timeoutMs: 25,
    maxAttempts: 2,
    retryDelayMs: 0,
    fetcher: async (_url, init) =>
      await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      })
  });
  const store = await createTestStore(provider);
  const app = createApp(store);

  await new Promise<void>((resolve) => app.listen(0, resolve));
  t.after(async () => {
    await new Promise<void>((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
    await store.close();
  });

  const address = app.address();
  assert.equal(typeof address, "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const response = await fetch(`${baseUrl}/cases`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": "timeout-wallet-1"
    },
    body: JSON.stringify({ walletAddress: "0x1111111111111111111111111111111111111111" })
  });

  assert.equal(response.status, 202);
  const body = await response.json();
  assert.equal(body.caseRecord.status, "ingestion_failed");
  assert.equal(body.auditEvents.at(-1)?.type, "PROVIDER_FETCH_FAILED");
  assert.equal(body.caseRecord.sourceMetadata.errorCode, "timeout");

  const readiness = await fetch(`${baseUrl}/ready`);
  const readinessBody = await readiness.json();
  assert.equal(readinessBody.store.caseCount, 1);
  assert.equal(readinessBody.store.auditEventCount, 3);
});

test("recovers a failed idempotent case instead of creating a duplicate", async (t) => {
  let callCount = 0;
  const provider = new EtherscanTransactionProvider({
    baseUrl: "https://example.test/api",
    timeoutMs: 5,
    maxAttempts: 1,
    retryDelayMs: 0,
    fetcher: async (_url, init) => {
      callCount += 1;
      if (callCount === 1) {
        await new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        });
      }

      return new Response(
        JSON.stringify({
          status: "1",
          result: [
            {
              hash: "0xaaaabbbbccccddddeeeeffff0000111122223333444455556666777788889999",
              from: "0x2222222222222222222222222222222222222222",
              to: "0x1111111111111111111111111111111111111111",
              value: "1250000000000000000",
              confirmations: "18"
            }
          ]
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    }
  });
  const store = await createTestStore(provider);
  const app = createApp(store);

  await new Promise<void>((resolve) => app.listen(0, resolve));
  t.after(async () => {
    await new Promise<void>((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
    await store.close();
  });

  const address = app.address();
  assert.equal(typeof address, "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const headers = {
    "content-type": "application/json",
    "idempotency-key": "recover-wallet-1"
  };

  const firstResponse = await fetch(`${baseUrl}/cases`, {
    method: "POST",
    headers,
    body: JSON.stringify({ walletAddress: "0x1111111111111111111111111111111111111111" })
  });
  const firstBody = await firstResponse.json();

  assert.equal(firstResponse.status, 202);
  assert.equal(firstBody.caseRecord.status, "ingestion_failed");

  const secondResponse = await fetch(`${baseUrl}/cases`, {
    method: "POST",
    headers,
    body: JSON.stringify({ walletAddress: "0x1111111111111111111111111111111111111111" })
  });
  const secondBody = await secondResponse.json();

  assert.equal(secondResponse.status, 200);
  assert.equal(secondBody.recovered, true);
  assert.equal(secondBody.caseRecord.id, firstBody.caseRecord.id);
  assert.equal(secondBody.caseRecord.status, "pending_review");
  assert.equal(secondBody.auditEvents.some((event) => event.type === "PROVIDER_FETCH_FAILED"), true);
  assert.equal(secondBody.auditEvents.at(-1)?.type, "HUMAN_REVIEW_PENDING");

  const readiness = await fetch(`${baseUrl}/ready`);
  const readinessBody = await readiness.json();
  assert.equal(readinessBody.store.caseCount, 1);
  assert.equal(readinessBody.store.auditEventCount, 6);
});

async function createTestStore(provider?: TransactionProvider): Promise<PostgresAuditStore> {
  const schema = `test_${randomUUID().replaceAll("-", "_")}`;
  const databaseUrl = process.env.CHAINOPS_DATABASE_URL;
  const store = databaseUrl
    ? new PostgresAuditStore({ databaseUrl, schema, provider })
    : createMemoryStore(schema, provider);
  await store.init();
  return store;
}

function createMemoryStore(schema: string, provider?: TransactionProvider): PostgresAuditStore {
  const db = newDb();
  const pgAdapter = db.adapters.createPg();
  const pool = new pgAdapter.Pool();
  return new PostgresAuditStore({ pool, schema, provider });
}
