import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { captureRuntimeParityEvidence } from "../src/ci-evidence.ts";

test("captures runtime parity and release evidence into a reviewable artifact bundle", async () => {
  const workingDir = await mkdtemp(path.join(os.tmpdir(), "chainops-ci-evidence-"));
  const runtimeParityPath = path.join(workingDir, "runtime-parity.json");
  const outputDir = path.join(workingDir, "artifact");

  await writeFile(
    runtimeParityPath,
    JSON.stringify({
      checkedAt: "2026-07-05T17:00:00.000Z",
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
        }
      ],
      error: "404 Not Found"
    })
  );

  const summary = await captureRuntimeParityEvidence({
    artifactName: "runtime-parity-evidence",
    outputDir,
    runtimeParityPath,
    baseUrl: "http://127.0.0.1:4317",
    now: new Date("2026-07-05T17:05:00.000Z"),
    env: {
      GITHUB_SERVER_URL: "https://github.com",
      GITHUB_REPOSITORY: "MSulSal/chainops-control",
      GITHUB_RUN_ID: "123456789",
      GITHUB_RUN_ATTEMPT: "2",
      GITHUB_REF_NAME: "main",
      GITHUB_SHA: "deadbeef"
    },
    fetcher: async (input) => {
      const url = String(input);

      if (url.endsWith("/exports/releases/latest")) {
        return new Response(
          JSON.stringify({
            release: {
              version: "0.1.0",
              channel: "local_container_runtime"
            }
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (url.endsWith("/exports/host-readiness")) {
        return new Response(
          JSON.stringify({
            generatedAt: "2026-07-06T20:00:00.000Z",
            scope: "host_readiness",
            overall: {
              statusLabel: "Watch",
              summary: "Provider-backed sandbox validation remains incomplete on this host."
            },
            runtime: {
              dockerComposeFile: "docker-compose.yml",
              terraformSandboxPath: "infra/terraform/sandbox",
              reviewerWorkspacePath: "/",
              apiBaseUrl: "http://127.0.0.1:4317"
            },
            checks: [],
            providerSandbox: {
              status: "warning",
              summary: "The host can keep exercising the deterministic runtime path.",
              missingRequirements: ["Terraform CLI: Terraform CLI is unavailable on this host."],
              nextSteps: ["Resolve Terraform CLI and rerun `terraform version -json`."]
            },
            boundaries: ["Local host readiness only."]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      return new Response("missing", { status: 404, statusText: "Not Found" });
    }
  });

  assert.equal(summary.runtimeParity.status, "captured");
  assert.equal(summary.runtimeParity.result?.status, "failed");
  assert.equal(summary.releaseRecord.status, "captured");
  assert.equal(summary.releaseRecord.version, "0.1.0");
  assert.equal(summary.hostReadiness.status, "captured");
  assert.equal(summary.hostReadiness.statusLabel, "Watch");
  assert.equal(
    summary.githubRun.runUrl,
    "https://github.com/MSulSal/chainops-control/actions/runs/123456789"
  );

  const readme = await readFile(path.join(outputDir, "README.md"), "utf8");
  assert.match(readme, /Runtime parity status: failed/);
  assert.match(readme, /Host-readiness status: Watch/);

  const runtimeParityArtifact = JSON.parse(await readFile(path.join(outputDir, "runtime-parity-latest.json"), "utf8"));
  assert.equal(runtimeParityArtifact.error, "404 Not Found");

  const releaseRecordArtifact = JSON.parse(await readFile(path.join(outputDir, "latest-release-record.json"), "utf8"));
  assert.equal(releaseRecordArtifact.release.version, "0.1.0");

  const hostReadinessArtifact = JSON.parse(await readFile(path.join(outputDir, "host-readiness.json"), "utf8"));
  assert.equal(hostReadinessArtifact.overall.statusLabel, "Watch");
});

test("keeps the artifact bundle reviewable when the live release record is unavailable", async () => {
  const workingDir = await mkdtemp(path.join(os.tmpdir(), "chainops-ci-evidence-"));
  const runtimeParityPath = path.join(workingDir, "runtime-parity.json");
  const outputDir = path.join(workingDir, "artifact");

  await writeFile(
    runtimeParityPath,
    JSON.stringify({
      checkedAt: "2026-07-05T18:00:00.000Z",
      baseUrl: "http://127.0.0.1:4317",
      status: "passed",
      summary: "The running service matched the current seeded runtime parity contract.",
      comparedExports: ["/exports/telemetry"],
      ignoredFields: ["generatedAt"],
      exportChecks: [
        {
          path: "/exports/telemetry",
          status: "matched",
          detail: "The runtime served the expected telemetry export during the seeded smoke flow."
        }
      ]
    })
  );

  const summary = await captureRuntimeParityEvidence({
    outputDir,
    runtimeParityPath,
    fetcher: async () => new Response("missing", { status: 404, statusText: "Not Found" })
  });

  assert.equal(summary.runtimeParity.status, "captured");
  assert.equal(summary.releaseRecord.status, "unavailable");
  assert.equal(summary.hostReadiness.status, "unavailable");
  assert.match(summary.releaseRecord.error ?? "", /404 Not Found/);
  assert.match(summary.hostReadiness.error ?? "", /404 Not Found/);

  const summaryJson = JSON.parse(await readFile(path.join(outputDir, "ci-evidence-summary.json"), "utf8"));
  assert.equal(summaryJson.releaseRecord.status, "unavailable");
  assert.equal(summaryJson.hostReadiness.status, "unavailable");
  assert.equal(Array.isArray(summaryJson.notes), true);
});
