import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { type AuditStore, PostgresAuditStore } from "./store.ts";
import { getTraceId, writeStructuredLog } from "./logger.ts";
import { normalizeApprovalDecision } from "./domain.ts";
import { createDefaultTransactionProviderFromEnv } from "./provider.ts";

type JsonBody = Record<string, unknown>;

export function createApp(store: AuditStore) {
  return createHttpServer(async (request, response) => {
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

      if (request.method === "POST" && url.pathname === "/cases") {
        const body = await readJsonBody(request);
        const created = await store.createCase({
          walletAddress: String(body.walletAddress ?? ""),
          traceId,
          now: new Date().toISOString(),
          idempotencyKey: headers.get("idempotency-key")?.trim() || undefined
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

      const approvalMatch = url.pathname.match(/^\/cases\/([^/]+)\/approval$/);
      if (request.method === "POST" && approvalMatch) {
        const body = await readJsonBody(request);
        const decision = normalizeApprovalDecision(body.decision);
        const approved = await store.approveCase({
          caseId: approvalMatch[1],
          decision,
          traceId,
          now: new Date().toISOString(),
          note: typeof body.note === "string" ? body.note : undefined
        });

        writeStructuredLog("case.reviewed", {
          traceId,
          caseId: approved.caseRecord.id,
          status: approved.caseRecord.status
        });

        return sendJson(response, 200, approved);
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

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
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
