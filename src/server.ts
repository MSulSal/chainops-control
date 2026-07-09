import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import type { CaseListFilters, CaseStatus, RiskLevel } from "./domain.ts";
import { type AuditStore, PostgresAuditStore } from "./store.ts";
import { getTraceId, writeStructuredLog } from "./logger.ts";
import { normalizeApprovalDecision, normalizeReviewerNote } from "./domain.ts";
import { createDefaultTransactionProviderFromEnv } from "./provider.ts";
import {
  buildCaseIncidentSnapshot,
  buildOpenTelemetryExportSnapshot,
  buildReleaseRecordSnapshot,
  buildTelemetryHandoffSnapshot,
  buildWorkspaceIncidentSnapshot
} from "./incident-snapshot.ts";
import { collectHostReadinessSnapshot, type HostReadinessSnapshot } from "./host-readiness.ts";
import { readLatestRuntimeParityResult } from "./runtime-parity.ts";
import { DEMO_SCENARIO_NAME } from "./demo-scenario.ts";

type JsonBody = Record<string, unknown>;

export function createApp(
  store: AuditStore,
  options: {
    loadHostReadinessSnapshot?: () => Promise<HostReadinessSnapshot>;
  } = {}
) {
  return createHttpServer(async (request, response) => {
    const requestStartedAtMs = performance.now();
    const url = new URL(request.url ?? "/", "http://localhost");
    const headers = new Headers(request.headers as Record<string, string>);
    const traceId = getTraceId(headers);

    response.setHeader("content-type", "application/json");
    response.setHeader("x-trace-id", traceId);

    try {
      if (request.method === "GET" && url.pathname === "/health") {
        return sendJson(response, 200, { status: "ok", service: "chainops-control" });
      }

      if (request.method === "GET" && url.pathname === "/ready") {
        const health = await store.health();
        return sendJson(response, 200, { status: "ready", store: health });
      }

      if (request.method === "GET" && url.pathname === "/cases") {
        const cases = await store.listCases(readCaseListFilters(url.searchParams));
        return sendJson(response, 200, cases);
      }

      if (request.method === "GET" && url.pathname === "/exports/workspace") {
        const cases = await store.listCases(readCaseListFilters(url.searchParams));
        return sendJson(response, 200, buildWorkspaceIncidentSnapshot(cases), {
          "content-disposition": 'attachment; filename="workspace-incident-snapshot.json"'
        });
      }

      if (request.method === "GET" && url.pathname === "/exports/host-readiness") {
        const snapshot = options.loadHostReadinessSnapshot
          ? await options.loadHostReadinessSnapshot()
          : await collectHostReadinessSnapshot();
        return sendJson(response, 200, snapshot, {
          "content-disposition": 'attachment; filename="host-readiness.json"'
        });
      }

      if (request.method === "GET" && url.pathname === "/exports/telemetry/opentelemetry") {
        const cases = await store.listCases(readCaseListFilters(url.searchParams));
        const caseDetails = (
          await Promise.all(cases.cases.slice(0, 5).map(async (caseItem) => await store.findCase(caseItem.id)))
        ).filter((detail): detail is NonNullable<typeof detail> => detail !== null);
        return sendJson(response, 200, buildOpenTelemetryExportSnapshot({ ...cases, caseDetails }), {
          "content-disposition": 'attachment; filename="opentelemetry-export.json"'
        });
      }

      if (request.method === "GET" && url.pathname === "/exports/telemetry") {
        const cases = await store.listCases(readCaseListFilters(url.searchParams));
        return sendJson(response, 200, buildTelemetryHandoffSnapshot(cases), {
          "content-disposition": 'attachment; filename="telemetry-handoff.json"'
        });
      }

      if (request.method === "GET" && url.pathname === "/exports/releases/latest") {
        const cases = await store.listCases(readCaseListFilters(url.searchParams));
        const caseDetails = (
          await Promise.all(cases.cases.map(async (caseItem) => await store.findCase(caseItem.id)))
        ).filter((detail): detail is NonNullable<typeof detail> => detail !== null);
        const lastHostReadinessSnapshot = options.loadHostReadinessSnapshot
          ? await options.loadHostReadinessSnapshot()
          : await collectHostReadinessSnapshot();
        const lastRuntimeParityResult = await readLatestRuntimeParityResult();
        return sendJson(
          response,
          200,
          buildReleaseRecordSnapshot({ ...cases, caseDetails, lastHostReadinessSnapshot, lastRuntimeParityResult }),
          {
            "content-disposition": 'attachment; filename="latest-release-record.json"'
          }
        );
      }

      if (request.method === "GET" && url.pathname === "/exports/runtime-parity/latest") {
        const lastRuntimeParityResult = await readLatestRuntimeParityResult();
        if (!lastRuntimeParityResult) {
          return sendJson(response, 404, { error: "runtime parity result not found", traceId });
        }

        return sendJson(response, 200, lastRuntimeParityResult, {
          "content-disposition": 'attachment; filename="runtime-parity-latest.json"'
        });
      }

      if (request.method === "POST" && url.pathname === "/demo/reset") {
        const result = await store.resetDemoScenario(readDemoScenario(url, request));
        return sendJson(response, 200, result);
      }

      if (request.method === "POST" && url.pathname === "/cases") {
        const body = await readJsonBody(request);
        const created = await store.createCase({
          walletAddress: String(body.walletAddress ?? ""),
          traceId,
          now: new Date().toISOString(),
          idempotencyKey: headers.get("idempotency-key")?.trim() || undefined,
          requestStartedAtMs
        });

        writeStructuredLog("case.created", {
          traceId,
          caseId: created.caseRecord.id,
          riskLevel: created.caseRecord.risk.level,
          replayed: created.replayed,
          recovered: created.recovered,
          status: created.caseRecord.status
        });

        const status =
          created.replayed || created.recovered
            ? 200
            : created.caseRecord.status === "ingestion_failed"
              ? 202
              : 201;
        return sendJson(response, status, created);
      }

      const caseMatch = url.pathname.match(/^\/cases\/([^/]+)$/);
      if (request.method === "GET" && caseMatch) {
        const found = await store.findCase(caseMatch[1]);
        if (!found) {
          return sendJson(response, 404, { error: "case not found", traceId });
        }

        return sendJson(response, 200, found);
      }

      const caseExportMatch = url.pathname.match(/^\/exports\/cases\/([^/]+)$/);
      if (request.method === "GET" && caseExportMatch) {
        const found = await store.findCase(caseExportMatch[1]);
        if (!found) {
          return sendJson(response, 404, { error: "case not found", traceId });
        }

        const cases = await store.listCases({});
        const caseDetails = (
          await Promise.all(cases.cases.map(async (caseItem) => await store.findCase(caseItem.id)))
        ).filter((detail): detail is NonNullable<typeof detail> => detail !== null);
        const lastHostReadinessSnapshot = options.loadHostReadinessSnapshot
          ? await options.loadHostReadinessSnapshot()
          : await collectHostReadinessSnapshot();
        const lastRuntimeParityResult = await readLatestRuntimeParityResult();
        const releaseRecord = buildReleaseRecordSnapshot({
          ...cases,
          caseDetails,
          lastHostReadinessSnapshot,
          lastRuntimeParityResult
        });

        return sendJson(response, 200, buildCaseIncidentSnapshot({ ...found, releaseRecord }), {
          "content-disposition": `attachment; filename="case-${caseExportMatch[1]}-incident-snapshot.json"`
        });
      }

      const approvalMatch = url.pathname.match(/^\/cases\/([^/]+)\/approval$/);
      if (request.method === "POST" && approvalMatch) {
        const body = await readJsonBody(request);
        const decision = normalizeApprovalDecision(body.decision);
        const note = normalizeReviewerNote(body.note);
        const approved = await store.approveCase({
          caseId: approvalMatch[1],
          decision,
          traceId,
          now: new Date().toISOString(),
          note,
          requestStartedAtMs
        });

        writeStructuredLog("case.reviewed", {
          traceId,
          caseId: approved.caseRecord.id,
          status: approved.caseRecord.status
        });

        return sendJson(response, 200, approved);
      }

      const replayMatch = url.pathname.match(/^\/cases\/([^/]+)\/replay$/);
      if (request.method === "POST" && replayMatch) {
        const replayed = await store.replayFailedCase({
          caseId: replayMatch[1],
          traceId,
          now: new Date().toISOString(),
          requestStartedAtMs,
          requestedFrom: "reviewer_case_detail"
        });

        writeStructuredLog("case.replayed", {
          traceId,
          caseId: replayed.caseRecord.id,
          status: replayed.caseRecord.status,
          recovered: replayed.recovered,
          replayAttempt: replayed.replayAttempt
        });

        return sendJson(response, 200, replayed);
      }

      return sendJson(response, 404, { error: "route not found", traceId });
    } catch (error) {
      writeStructuredLog("request.failed", {
        traceId,
        path: url.pathname,
        error: (error as Error).message
      });

      const status = (error as Error).message === "case not found" ? 404 : 400;
      return sendJson(response, status, { error: (error as Error).message, traceId });
    }
  });
}

function readCaseListFilters(searchParams: URLSearchParams): Partial<CaseListFilters> {
  return {
    limit: readLimit(searchParams.get("limit")),
    status: readEnumValue<CaseStatus>(searchParams.get("status"), [
      "pending_review",
      "approved",
      "rejected",
      "ingestion_failed"
    ]),
    riskLevel: readEnumValue<RiskLevel>(searchParams.get("risk"), ["low", "medium", "high"]),
    search: searchParams.get("q")?.trim() || undefined
  };
}

function readDemoScenario(url: URL, request: IncomingMessage): typeof DEMO_SCENARIO_NAME {
  const fromQuery = url.searchParams.get("scenario")?.trim();
  const fromHeader = request.headers["x-demo-scenario"]?.toString().trim();
  const scenario = fromQuery || fromHeader || DEMO_SCENARIO_NAME;

  if (scenario !== DEMO_SCENARIO_NAME) {
    throw new Error(`unknown demo scenario: ${scenario}`);
  }

  return DEMO_SCENARIO_NAME;
}

function readLimit(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error("limit must be a positive number");
  }

  return parsed;
}

function readEnumValue<T extends string>(value: string | null, allowed: T[]): T | undefined {
  if (!value) {
    return undefined;
  }

  if (!allowed.includes(value as T)) {
    throw new Error(`invalid value: ${value}`);
  }

  return value as T;
}

async function readJsonBody(request: IncomingMessage): Promise<JsonBody> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as JsonBody;
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): void {
  response.statusCode = status;
  for (const [key, value] of Object.entries(headers)) {
    response.setHeader(key, value);
  }
  response.end(JSON.stringify(body));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4317);
  const databaseUrl =
    process.env.CHAINOPS_DATABASE_URL ?? "postgres://chainops:chainops@127.0.0.1:5432/chainops";
  const schema = process.env.CHAINOPS_SCHEMA ?? "public";
  const provider = createDefaultTransactionProviderFromEnv();
  const store = new PostgresAuditStore({ databaseUrl, schema, provider });
  const app = createApp(store);

  await store.init();
  app.listen(port, () => {
    writeStructuredLog("service.started", { port, schema, databaseConfigured: true });
  });
}
