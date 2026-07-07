import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { runSeededDemoSmokeTest } from "../src/demo-smoke.ts";
import {
  RUNTIME_PARITY_ARTIFACT_FILES,
  RUNTIME_PARITY_ARTIFACT_REVIEW_HINT,
  writeLatestRuntimeParityResult,
  type RuntimeParityCiEvidence
} from "../src/runtime-parity.ts";

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
const comparedExports = ["/exports/telemetry", "/exports/telemetry/opentelemetry", "/exports/releases/latest"];
const artifactName = process.env.CHAINOPS_CI_ARTIFACT_NAME?.trim() || "runtime-parity-evidence";
const ignoredFields = [
  "generatedAt",
  "verification.hostReadiness.lastResult.generatedAt",
  "queueEvidence.analytics.reviewLatency.oldestPendingHours",
  "queueEvidence.releaseGuide.evidence[*] old pending-review age text",
  "evidence.analytics.reviewLatency.oldestPendingHours",
  "evidence.releaseGuide.evidence[*] old pending-review age text",
  "rollback.evidence[*] old pending-review age text"
];

async function main() {
  const ciEvidence = buildCiEvidence();

  try {
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
    await writeLatestRuntimeParityResult({
      checkedAt: new Date().toISOString(),
      baseUrl,
      status: "passed",
      summary: "The running service matched the current seeded runtime parity contract.",
      comparedExports,
      ignoredFields,
      exportChecks: comparedExports.map((exportPath) => ({
        path: exportPath,
        status: "matched",
        detail: "The runtime served the expected parity export during the seeded smoke flow."
      })),
      scenario: result.scenario,
      failedCaseId: result.failedCaseId,
      traceIds: result.traceIds,
      ciEvidence
    });
    console.log(
      `runtime parity gate passed: ${result.scenario} | failed case ${result.failedCaseId} | traces ${result.traceIds.join(", ")}`
    );
  } catch (error) {
    await writeLatestRuntimeParityResult({
      checkedAt: new Date().toISOString(),
      baseUrl,
      status: "failed",
      summary: "The running service failed the seeded runtime parity gate and should be treated as stale.",
      comparedExports,
      ignoredFields,
      exportChecks: comparedExports.map((exportPath) => ({
        path: exportPath,
        status: "not_checked",
        detail: "The seeded runtime flow did not reach this export check before failing."
      })),
      error: (error as Error).message,
      ciEvidence
    });
    throw error;
  }
}

function buildCiEvidence(env: NodeJS.ProcessEnv = process.env): RuntimeParityCiEvidence | undefined {
  const repository = env.GITHUB_REPOSITORY?.trim();
  const runId = env.GITHUB_RUN_ID?.trim();
  const serverUrl = env.GITHUB_SERVER_URL?.trim();
  const runUrl = repository && runId && serverUrl ? `${serverUrl}/${repository}/actions/runs/${runId}` : undefined;

  if (!repository && !runId && !serverUrl && env.GITHUB_ACTIONS !== "true") {
    return undefined;
  }

  return {
    provider: "github_actions",
    artifactName,
    artifactFiles: [...RUNTIME_PARITY_ARTIFACT_FILES],
    reviewHint: RUNTIME_PARITY_ARTIFACT_REVIEW_HINT,
    captures: {
      runtimeParity: {
        status: "captured"
      },
      releaseRecord: {
        status: "unavailable"
      },
      hostReadiness: {
        status: "unavailable"
      }
    },
    run: {
      repository,
      runId,
      runAttempt: env.GITHUB_RUN_ATTEMPT?.trim(),
      refName: env.GITHUB_REF_NAME?.trim(),
      sha: env.GITHUB_SHA?.trim(),
      serverUrl,
      runUrl
    }
  };
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
