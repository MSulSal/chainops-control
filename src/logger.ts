import { randomUUID } from "node:crypto";

export function writeStructuredLog(event: string, payload: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), event, ...payload })}\n`);
}

export function getTraceId(headers: Headers): string {
  return headers.get("x-request-id") ?? randomUUID();
}
