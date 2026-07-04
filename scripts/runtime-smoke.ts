import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { runSeededDemoSmokeTest } from "../src/demo-smoke.ts";

type HealthResponse = {
  status: string;
  service?: string;
};

type ReadyResponse = {
  status: string;
  store?: {
    ok: boolean;
    caseCount: number;
    auditEventCount: number;
  };
};

const baseUrl = (process.env.CHAINOPS_SMOKE_BASE_URL?.trim() || "http://127.0.0.1:4317").replace(/\/$/, "");
const timeoutMs = readNumberEnv("CHAINOPS_SMOKE_TIMEOUT_MS", 30_000);
const pollIntervalMs = readNumberEnv("CHAINOPS_SMOKE_POLL_INTERVAL_MS", 500);

async function main() {
  await waitForJson<HealthResponse>(
    `${baseUrl}/health`,
    (body) => {
      assert.equal(body.status, "ok");
      assert.equal(body.service, "chainops-control");
    },
    "health"
  );

  await waitForJson<ReadyResponse>(
    `${baseUrl}/ready`,
    (body) => {
      assert.equal(body.status, "ready");
      assert.equal(body.store?.ok, true);
    },
    "readiness"
  );

  const result = await runSeededDemoSmokeTest(baseUrl);
  console.log(
    `runtime parity gate passed: ${result.scenario} | failed case ${result.failedCaseId} | traces ${result.traceIds.join(", ")}`
  );
}

async function waitForJson<T>(url: string, validate: (body: T) => void, label: string): Promise<void> {
  const startedAt = Date.now();
  let lastError = "no response yet";

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        lastError = `${response.status} ${response.statusText}`;
      } else {
        const body = (await response.json()) as T;
        validate(body);
        return;
      }
    } catch (error) {
      lastError = (error as Error).message;
    }

    await delay(pollIntervalMs);
  }

  throw new Error(`timed out waiting for ${label} at ${url}: ${lastError}`);
}

function readNumberEnv(name: string, defaultValue: number): number {
  const value = process.env[name]?.trim();
  if (!value) {
    return defaultValue;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number`);
  }

  return parsed;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
