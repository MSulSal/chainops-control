import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { newDb } from "pg-mem";
import { runSeededDemoSmokeTest } from "../src/demo-smoke.ts";
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
  assert.equal(Number.isFinite(created.auditEvents[2].details.durationMs), true);
  assert.equal(Number.isFinite(created.auditEvents[4].details.durationMs), true);

  const approvalResponse = await fetch(`${baseUrl}/cases/${created.caseRecord.id}/approval`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ decision: "approve", note: "fixture reviewed" })
  });

  assert.equal(approvalResponse.status, 200);
  const approved = await approvalResponse.json();
  assert.equal(approved.caseRecord.status, "approved");
  assert.equal(approved.auditEvent.type, "HUMAN_APPROVED");
  assert.equal(Number.isFinite(approved.auditEvent.details.durationMs), true);

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

test("rejects reviewer decisions that do not include a note", async (t) => {
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
      "x-request-id": "trace-review-note-1"
    },
    body: JSON.stringify({ walletAddress: "0x1111111111111111111111111111111111111111" })
  });
  const created = await createResponse.json();

  const reviewResponse = await fetch(`${baseUrl}/cases/${created.caseRecord.id}/approval`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ decision: "approve", note: "   " })
  });

  assert.equal(reviewResponse.status, 400);
  const reviewBody = await reviewResponse.json();
  assert.match(reviewBody.error, /reviewer note is required/);

  const readResponse = await fetch(`${baseUrl}/cases/${created.caseRecord.id}`);
  const found = await readResponse.json();
  assert.equal(found.caseRecord.status, "pending_review");
  assert.equal(found.caseRecord.reviewerNote, undefined);
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
  assert.equal(Number.isFinite(body.auditEvents.at(-1)?.details.durationMs), true);
  assert.equal(Number.isFinite(body.auditEvents.at(-1)?.details.intakeDurationMs), true);

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
  assert.equal(secondBody.auditEvents.some((event) => event.type === "HUMAN_REVIEW_PENDING"), true);

  const readiness = await fetch(`${baseUrl}/ready`);
  const readinessBody = await readiness.json();
  assert.equal(readinessBody.store.caseCount, 1);
  assert.equal(readinessBody.store.auditEventCount, 6);
});

test("lists recent cases with failed-ingestion visibility, queue summaries, and filters", async (t) => {
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
              hash: "0xbbbbccccddddeeeeffff0000111122223333444455556666777788889999aaaa",
              from: "0x3333333333333333333333333333333333333333",
              to: "0x1111111111111111111111111111111111111111",
              value: "500000000000000000",
              confirmations: "25"
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

  await fetch(`${baseUrl}/cases`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": "list-failed-1"
    },
    body: JSON.stringify({ walletAddress: "0x1111111111111111111111111111111111111111" })
  });

  await fetch(`${baseUrl}/cases`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ walletAddress: "0x9999999999999999999999999999999999999999" })
  });

  const response = await fetch(`${baseUrl}/cases?limit=10`);
  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(body.cases.length, 2);
  assert.equal(body.summary.total, 2);
  assert.equal(body.summary.pendingReviewCount, 1);
  assert.equal(body.summary.failedIngestionCount, 1);
  assert.equal(body.summary.highRiskCount, 1);
  assert.equal(body.analytics.statusTransitions.enteredReviewCount, 1);
  assert.equal(body.analytics.statusTransitions.failedIngestionCount, 1);
  assert.equal(body.analytics.reviewLatency.reviewedCount, 0);
  assert.equal(body.analytics.operationalMetrics.intakePipeline.completedCount, 1);
  assert.equal(body.analytics.operationalMetrics.intakePipeline.failedCount, 1);
  assert.equal(body.analytics.operationalMetrics.providerFetch.completedCount, 1);
  assert.equal(body.analytics.operationalMetrics.providerFetch.failedCount, 1);
  assert.equal(Array.isArray(body.analytics.timeline), true);
  assert.equal(body.cases[0].walletAddress, "0x9999999999999999999999999999999999999999");
  assert.equal(body.cases[1].status, "ingestion_failed");
  assert.equal(body.cases[1].sourceMetadata.errorCode, "timeout");

  const filteredResponse = await fetch(`${baseUrl}/cases?status=pending_review&q=9999`);
  assert.equal(filteredResponse.status, 200);

  const filteredBody = await filteredResponse.json();
  assert.equal(filteredBody.cases.length, 1);
  assert.equal(filteredBody.summary.total, 1);
  assert.equal(filteredBody.summary.pendingReviewCount, 1);
  assert.equal(filteredBody.analytics.statusTransitions.enteredReviewCount, 1);
  assert.equal(filteredBody.filters.status, "pending_review");
  assert.equal(filteredBody.filters.search, "9999");
});

test("returns review latency and timeline analytics after reviewer decisions are recorded", async (t) => {
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
      "x-request-id": "trace-latency-1"
    },
    body: JSON.stringify({ walletAddress: "0x1111111111111111111111111111111111111111" })
  });
  const created = await createResponse.json();

  const reviewResponse = await fetch(`${baseUrl}/cases/${created.caseRecord.id}/approval`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ decision: "approve", note: "latency test approval" })
  });
  assert.equal(reviewResponse.status, 200);

  const listResponse = await fetch(`${baseUrl}/cases`);
  assert.equal(listResponse.status, 200);
  const listed = await listResponse.json();

  assert.equal(listed.analytics.statusTransitions.approvedCount, 1);
  assert.equal(listed.analytics.reviewLatency.reviewedCount, 1);
  assert.equal(listed.analytics.operationalMetrics.reviewerDecision.completedCount, 1);
  assert.equal(listed.analytics.operationalMetrics.reviewerDecision.averageDurationMs >= 0, true);
  assert.equal(listed.analytics.reviewLatency.averageHours >= 0, true);
  assert.equal(listed.analytics.timeline.length >= 1, true);
  assert.equal(listed.analytics.timeline.at(-1).approvedCount >= 1, true);
});

test("exports a workspace incident snapshot from the current filtered queue", async (t) => {
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

  await fetch(`${baseUrl}/cases`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": "trace-export-workspace-1"
    },
    body: JSON.stringify({ walletAddress: "0x1111111111111111111111111111111111111111" })
  });

  const response = await fetch(`${baseUrl}/exports/workspace?status=pending_review&risk=high`);
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("content-disposition"),
    'attachment; filename="workspace-incident-snapshot.json"'
  );

  const snapshot = await response.json();
  assert.equal(snapshot.scope, "workspace");
  assert.equal(snapshot.filters.status, "pending_review");
  assert.equal(snapshot.filters.riskLevel, "high");
  assert.equal(snapshot.summary.total, 1);
  assert.equal(snapshot.visibleCases[0].traceId, "trace-export-workspace-1");
  assert.equal(snapshot.releaseGuide.statusLabel, "Ready");
});

test("exports a host-readiness artifact for current host prerequisites", async (t) => {
  const store = await createTestStore();
  const app = createApp(store, {
    loadHostReadinessSnapshot: async () => ({
      generatedAt: "2026-07-06T20:00:00.000Z",
      scope: "host_readiness",
      overall: {
        statusLabel: "Blocked",
        summary: "Provider-backed sandbox validation is blocked on this host until Docker engine and Terraform CLI are fixed."
      },
      runtime: {
        dockerComposeFile: "docker-compose.yml",
        terraformSandboxPath: "infra/terraform/sandbox",
        reviewerWorkspacePath: "/",
        apiBaseUrl: "http://127.0.0.1:4317"
      },
      checks: [
        {
          key: "docker_engine",
          label: "Docker engine",
          status: "blocked",
          summary: "Docker engine is not reachable from this host.",
          detail: "open //./pipe/docker_engine: The system cannot find the file specified.",
          command: "docker info --format {{.ServerVersion}}"
        }
      ],
      providerSandbox: {
        status: "blocked",
        summary: "The first provider-backed sandbox attempt should stay paused on this host.",
        missingRequirements: ["Docker engine: Docker engine is not reachable from this host."],
        nextSteps: ["Resolve docker engine and rerun `docker info --format {{.ServerVersion}}`."]
      },
      boundaries: ["Local host readiness only."]
    })
  });

  await new Promise<void>((resolve) => app.listen(0, resolve));
  t.after(async () => {
    await new Promise<void>((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
    await store.close();
  });

  const address = app.address();
  assert.equal(typeof address, "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const response = await fetch(`${baseUrl}/exports/host-readiness`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-disposition"), 'attachment; filename="host-readiness.json"');

  const snapshot = await response.json();
  assert.equal(snapshot.scope, "host_readiness");
  assert.equal(snapshot.overall.statusLabel, "Blocked");
  assert.equal(snapshot.checks[0].key, "docker_engine");
  assert.equal(snapshot.providerSandbox.status, "blocked");
});

test("exports a telemetry handoff artifact from the current filtered queue", async (t) => {
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

  await fetch(`${baseUrl}/cases`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": "trace-export-telemetry-1"
    },
    body: JSON.stringify({ walletAddress: "0x1111111111111111111111111111111111111111" })
  });

  const response = await fetch(`${baseUrl}/exports/telemetry?status=pending_review&risk=high`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-disposition"), 'attachment; filename="telemetry-handoff.json"');

  const snapshot = await response.json();
  assert.equal(snapshot.scope, "telemetry_handoff");
  assert.equal(snapshot.service.api.healthPath, "/health");
  assert.equal(snapshot.service.api.openTelemetryExportPath, "/exports/telemetry/opentelemetry");
  assert.equal(snapshot.queueEvidence.filters.status, "pending_review");
  assert.equal(snapshot.queueEvidence.filters.riskLevel, "high");
  assert.equal(snapshot.queueEvidence.summary.total, 1);
  assert.equal(snapshot.queueEvidence.traceSamples[0].traceId, "trace-export-telemetry-1");
  assert.equal(snapshot.smoke.demoCommand, "npm run smoke:demo");
  assert.equal(snapshot.collectorNotes.status, "bounded_planning_only");
  assert.equal(snapshot.collectorNotes.recommendedMappings.length >= 3, true);
});

test("exports a bounded OpenTelemetry seam from persisted audit evidence", async (t) => {
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
      "x-request-id": "trace-export-otel-1"
    },
    body: JSON.stringify({ walletAddress: "0x1111111111111111111111111111111111111111" })
  });
  const created = await createResponse.json();

  const reviewResponse = await fetch(`${baseUrl}/cases/${created.caseRecord.id}/approval`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ decision: "approve", note: "reviewed for otel export" })
  });
  assert.equal(reviewResponse.status, 200);

  const response = await fetch(`${baseUrl}/exports/telemetry/opentelemetry?status=approved&risk=high`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-disposition"), 'attachment; filename="opentelemetry-export.json"');

  const snapshot = await response.json();
  assert.equal(snapshot.scope, "opentelemetry_export");
  assert.equal(snapshot.resource.serviceName, "chainops-control");
  assert.equal(snapshot.resource.serviceVersion, "0.1.0");
  assert.equal(snapshot.filters.status, "approved");
  assert.equal(snapshot.filters.riskLevel, "high");
  assert.equal(snapshot.summary.total, 1);
  assert.equal(snapshot.traces.length, 1);
  assert.equal(snapshot.traces[0].traceId, "trace-export-otel-1");
  assert.deepEqual(
    snapshot.traces[0].spans.map((span) => span.name),
    ["chainops.intake_pipeline", "chainops.provider_fetch", "chainops.reviewer_decision"]
  );
  assert.equal(snapshot.traces[0].spans.every((span) => /^[a-f0-9]{16}$/.test(span.spanId)), true);
  assert.equal(snapshot.metrics.some((metric) => metric.name === "chainops.provider_fetch.duration"), true);
  assert.equal(snapshot.links.telemetryHandoffPath, "/exports/telemetry");
  assert.match(snapshot.boundaries[0], /does not emit OTLP traffic/i);
});

test("exports a latest release record artifact from the current filtered queue", async (t) => {
  const provider = new EtherscanTransactionProvider({
    baseUrl: "https://example.test/api",
    timeoutMs: 25,
    maxAttempts: 1,
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

  await fetch(`${baseUrl}/cases`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": "release-record-timeout",
      "x-request-id": "trace-release-record-timeout"
    },
    body: JSON.stringify({ walletAddress: "0x1111111111111111111111111111111111111111" })
  });

  const runtimeParityDir = await mkdtemp(path.join(os.tmpdir(), "chainops-runtime-parity-"));
  process.env.CHAINOPS_RUNTIME_PARITY_PATH = path.join(runtimeParityDir, "latest.json");
  t.after(() => {
    delete process.env.CHAINOPS_RUNTIME_PARITY_PATH;
  });
  await writeFile(
    process.env.CHAINOPS_RUNTIME_PARITY_PATH,
    JSON.stringify({
      checkedAt: "2026-07-04T18:00:00.000Z",
      baseUrl: "http://127.0.0.1:4317",
      status: "failed",
      summary: "The running service failed the seeded runtime parity gate and should be treated as stale.",
      comparedExports: ["/exports/telemetry", "/exports/telemetry/opentelemetry", "/exports/releases/latest"],
      ignoredFields: ["generatedAt"],
      exportChecks: [
        {
          path: "/exports/telemetry",
          status: "matched",
          detail: "The runtime served the expected telemetry export."
        },
        {
          path: "/exports/telemetry/opentelemetry",
          status: "missing",
          detail: "The runtime returned 404 for the OpenTelemetry export."
        },
        {
          path: "/exports/releases/latest",
          status: "not_checked",
          detail: "The seeded runtime flow stopped before this export check."
        }
      ],
      error: "404 Not Found",
      ciEvidence: {
        provider: "github_actions",
        artifactName: "runtime-parity-evidence",
        artifactFiles: [
          "runtime-parity-latest.json",
          "latest-release-record.json",
          "host-readiness.json",
          "ci-evidence-summary.json",
          "README.md"
        ],
        reviewHint:
          "Download the runtime-parity-evidence artifact from this GitHub Actions run to inspect the raw parity JSON, release record JSON, host-readiness JSON, and capture summary without rerunning the live smoke path.",
        run: {
          repository: "MSulSal/chainops-control",
          runId: "123456789",
          runAttempt: "2",
          refName: "main",
          sha: "deadbeef",
          serverUrl: "https://github.com",
          runUrl: "https://github.com/MSulSal/chainops-control/actions/runs/123456789"
        }
      }
    })
  );

  const response = await fetch(`${baseUrl}/exports/releases/latest?status=ingestion_failed`);
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("content-disposition"),
    'attachment; filename="latest-release-record.json"'
  );

  const snapshot = await response.json();
  assert.equal(snapshot.scope, "release_record");
  assert.equal(snapshot.filters.status, "ingestion_failed");
  assert.equal(snapshot.release.version, "0.1.0");
  assert.equal(snapshot.release.channel, "local_container_runtime");
  assert.equal(snapshot.verification.endpoints.releaseRecordPath, "/exports/releases/latest");
  assert.equal(snapshot.verification.endpoints.hostReadinessPath, "/exports/host-readiness");
  assert.equal(snapshot.verification.endpoints.openTelemetryExportPath, "/exports/telemetry/opentelemetry");
  assert.equal(snapshot.verification.hostReadiness.artifactPath, "/exports/host-readiness");
  assert.equal(snapshot.verification.hostReadiness.lastResult?.overall.statusLabel, "Blocked");
  assert.match(snapshot.verification.hostReadiness.failureMode, /provider-backed sandbox attempt as blocked/i);
  assert.deepEqual(snapshot.verification.runtimeParity.comparedExports, [
    "/exports/telemetry",
    "/exports/telemetry/opentelemetry",
    "/exports/releases/latest"
  ]);
  assert.match(snapshot.verification.runtimeParity.failureMode, /runtime as stale/i);
  assert.equal(snapshot.verification.runtimeParity.lastResult?.status, "failed");
  assert.equal(snapshot.verification.runtimeParity.lastResult?.exportChecks[1]?.status, "missing");
  assert.equal(snapshot.verification.runtimeParity.reviewArtifact?.artifactName, "runtime-parity-evidence");
  assert.equal(
    snapshot.verification.runtimeParity.reviewArtifact?.run.runUrl,
    "https://github.com/MSulSal/chainops-control/actions/runs/123456789"
  );
  assert.equal(snapshot.verification.requiredCommands.length, 4);
  assert.equal(snapshot.evidence.summary.failedIngestionCount, 1);
  assert.equal(snapshot.evidence.focusTraceId, "trace-release-record-timeout");
  assert.match(snapshot.rollback.decision, /roll back/i);
});

test("returns the latest persisted runtime parity result when available", async (t) => {
  const store = await createTestStore();
  const app = createApp(store);
  const runtimeParityDir = await mkdtemp(path.join(os.tmpdir(), "chainops-runtime-parity-"));
  process.env.CHAINOPS_RUNTIME_PARITY_PATH = path.join(runtimeParityDir, "latest.json");

  await writeFile(
    process.env.CHAINOPS_RUNTIME_PARITY_PATH,
    JSON.stringify({
      checkedAt: "2026-07-04T19:00:00.000Z",
      baseUrl: "http://127.0.0.1:4317",
      status: "passed",
      summary: "The running service matched the current seeded runtime parity contract.",
      comparedExports: ["/exports/telemetry", "/exports/telemetry/opentelemetry", "/exports/releases/latest"],
      ignoredFields: ["generatedAt"],
      exportChecks: [
        {
          path: "/exports/telemetry",
          status: "matched",
          detail: "The runtime served the expected parity export during the seeded smoke flow."
        }
      ],
      scenario: "incident_review_v1",
      failedCaseId: "44444444-4444-4444-8444-444444444444",
      traceIds: ["trace-demo-provider-timeout"],
      ciEvidence: {
        provider: "github_actions",
        artifactName: "runtime-parity-evidence",
        artifactFiles: [
          "runtime-parity-latest.json",
          "latest-release-record.json",
          "host-readiness.json",
          "ci-evidence-summary.json",
          "README.md"
        ],
        reviewHint:
          "Download the runtime-parity-evidence artifact from this GitHub Actions run to inspect the raw parity JSON, release record JSON, host-readiness JSON, and capture summary without rerunning the live smoke path.",
        run: {
          repository: "MSulSal/chainops-control",
          runId: "987654321",
          serverUrl: "https://github.com",
          runUrl: "https://github.com/MSulSal/chainops-control/actions/runs/987654321"
        }
      }
    })
  );

  await new Promise<void>((resolve) => app.listen(0, resolve));
  t.after(async () => {
    delete process.env.CHAINOPS_RUNTIME_PARITY_PATH;
    await new Promise<void>((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
    await store.close();
  });

  const address = app.address();
  assert.equal(typeof address, "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const response = await fetch(`${baseUrl}/exports/runtime-parity/latest`);
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("content-disposition"),
    'attachment; filename="runtime-parity-latest.json"'
  );

  const snapshot = await response.json();
  assert.equal(snapshot.status, "passed");
  assert.equal(snapshot.scenario, "incident_review_v1");
  assert.equal(snapshot.exportChecks[0].path, "/exports/telemetry");
  assert.equal(snapshot.ciEvidence?.artifactName, "runtime-parity-evidence");
});

test("exports a case incident snapshot with trace-backed guide and audit evidence", async (t) => {
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
      "x-request-id": "trace-export-case-1"
    },
    body: JSON.stringify({ walletAddress: "0x1111111111111111111111111111111111111111" })
  });
  const created = await createResponse.json();

  const response = await fetch(`${baseUrl}/exports/cases/${created.caseRecord.id}`);
  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-disposition") ?? "",
    /^attachment; filename="case-.*-incident-snapshot\.json"$/
  );

  const snapshot = await response.json();
  assert.equal(snapshot.scope, "case");
  assert.equal(snapshot.caseRecord.id, created.caseRecord.id);
  assert.equal(snapshot.incidentGuide.statusLabel, "Watch");
  assert.equal(Array.isArray(snapshot.auditEvents), true);
  assert.equal(snapshot.stageTrace.length, 3);
});

test("resets the seeded demo scenario and regenerates stable incident evidence", async (t) => {
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

  const smoke = await runSeededDemoSmokeTest(baseUrl);
  assert.equal(smoke.scenario, "incident_review_v1");
  assert.equal(smoke.failedCaseId, "44444444-4444-4444-8444-444444444444");
  assert.ok(smoke.traceIds.includes("trace-demo-provider-timeout"));
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
