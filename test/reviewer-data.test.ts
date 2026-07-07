import assert from "node:assert/strict";
import test from "node:test";
import { fetchHostReadinessSnapshot, fetchLatestReleaseRecord, getHostReadinessUrl } from "../src/reviewer-data.ts";

test("fetches the latest release record with reviewer filters", async () => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.CHAINOPS_API_BASE_URL;

  process.env.CHAINOPS_API_BASE_URL = "http://127.0.0.1:9999";

  let requestedUrl = "";
  globalThis.fetch = (async (input) => {
    requestedUrl = String(input);

    return new Response(
      JSON.stringify({
        generatedAt: "2026-07-05T18:30:00.000Z",
        scope: "release_record",
        filters: { status: "ingestion_failed", riskLevel: "high", search: "trace-demo", limit: 20 },
        release: {
          version: "0.1.0",
          channel: "local_container_runtime",
          statusLabel: "Hold",
          summary: "Runtime parity failed for the current release candidate.",
          containerImages: {
            api: "local Dockerfile build via docker compose service api",
            postgres: "postgres:16-alpine"
          },
          reviewerWorkspacePath: "/"
        },
        verification: {
          requiredCommands: [
            {
              name: "unit_and_api_contracts",
              command: "npm test",
              purpose: "Verify service behavior."
            }
          ],
          endpoints: {
            healthPath: "/health",
            readyPath: "/ready",
            demoResetPath: "/demo/reset",
            workspaceExportPath: "/exports/workspace",
            telemetryExportPath: "/exports/telemetry",
            openTelemetryExportPath: "/exports/telemetry/opentelemetry",
            hostReadinessPath: "/exports/host-readiness",
            releaseRecordPath: "/exports/releases/latest"
          },
          seededScenario: {
            name: "incident_review_v1",
            expectedTraceIds: ["trace-demo-provider-timeout"]
          },
          hostReadiness: {
            artifactPath: "/exports/host-readiness",
            failureMode: "Treat the first provider-backed sandbox attempt as blocked.",
            lastResult: {
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
            }
          },
          runtimeParity: {
            comparedExports: ["/exports/telemetry", "/exports/releases/latest"],
            ignoredFields: ["generatedAt"],
            failureMode: "Treat the runtime as stale.",
            lastResult: null,
            reviewArtifact: {
              provider: "github_actions",
              artifactName: "runtime-parity-evidence",
              artifactFiles: [
                "runtime-parity-latest.json",
                "latest-release-record.json",
                "host-readiness.json",
                "ci-evidence-summary.json",
                "README.md"
              ],
              reviewHint: "Download the runtime-parity-evidence artifact.",
              captures: {
                runtimeParity: {
                  status: "captured"
                },
                releaseRecord: {
                  status: "captured"
                },
                hostReadiness: {
                  status: "captured",
                  statusLabel: "Blocked"
                }
              },
              run: {
                runUrl: "https://github.com/MSulSal/chainops-control/actions/runs/123456789"
              }
            }
          }
        },
        evidence: {
          summary: {
            total: 1,
            pendingReviewCount: 0,
            approvedCount: 0,
            rejectedCount: 0,
            failedIngestionCount: 1,
            highRiskCount: 1
          },
          analytics: {
            statusTransitions: {
              enteredReviewCount: 0,
              approvedCount: 0,
              rejectedCount: 0,
              failedIngestionCount: 1
            },
            reviewLatency: {
              reviewedCount: 0,
              averageHours: null,
              oldestPendingHours: null
            },
            operationalMetrics: {
              intakePipeline: {
                averageDurationMs: null,
                maxDurationMs: null,
                completedCount: 0,
                failedCount: 1
              },
              providerFetch: {
                averageDurationMs: null,
                maxDurationMs: null,
                completedCount: 0,
                failedCount: 1
              },
              reviewerDecision: {
                averageDurationMs: null,
                maxDurationMs: null,
                completedCount: 0,
                failedCount: 0
              }
            },
            timeline: []
          },
          releaseGuide: {
            title: "Hold release",
            tone: "danger",
            statusLabel: "Hold",
            summary: "Runtime drift needs review.",
            releaseDecision: "Do not treat this release as current.",
            rollbackDecision: "Roll back after comparing the stale runtime evidence.",
            actions: ["Review the failed export path."],
            evidence: ["OpenTelemetry export was missing."]
          },
          telemetryHandoffPath: "/exports/telemetry",
          workspaceSnapshotPath: "/exports/workspace",
          focusCasePath: "/cases/case-1",
          focusCaseExportPath: "/exports/cases/case-1",
          focusTraceId: "trace-demo-provider-timeout"
        },
        rollback: {
          decision: "Roll back after comparing the stale runtime evidence.",
          triggers: ["Missing required export."],
          evidence: ["Focus case case-1 / trace trace-demo-provider-timeout."]
        },
        boundaries: ["Local runtime contract only."]
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" }
      }
    );
  }) as typeof fetch;

  try {
    const record = await fetchLatestReleaseRecord({
      status: "ingestion_failed",
      risk: "high",
      query: "trace-demo",
      limit: 20
    });

    assert.match(
      requestedUrl,
      /http:\/\/127\.0\.0\.1:9999\/exports\/releases\/latest\?limit=20&status=ingestion_failed&risk=high&q=trace-demo/
    );
    assert.equal(record.scope, "release_record");
    assert.equal(record.release.version, "0.1.0");
    assert.equal(record.verification.hostReadiness.lastResult?.overall.statusLabel, "Blocked");
    assert.equal(record.verification.runtimeParity.reviewArtifact?.captures?.hostReadiness.status, "captured");
    assert.equal(record.evidence.focusTraceId, "trace-demo-provider-timeout");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) {
      delete process.env.CHAINOPS_API_BASE_URL;
    } else {
      process.env.CHAINOPS_API_BASE_URL = originalBaseUrl;
    }
  }
});

test("fetches the host-readiness artifact from the API boundary", async () => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.CHAINOPS_API_BASE_URL;

  process.env.CHAINOPS_API_BASE_URL = "http://127.0.0.1:9999";

  let requestedUrl = "";
  globalThis.fetch = (async (input) => {
    requestedUrl = String(input);

    return new Response(
      JSON.stringify({
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
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" }
      }
    );
  }) as typeof fetch;

  try {
    const snapshot = await fetchHostReadinessSnapshot();

    assert.equal(getHostReadinessUrl(), "http://127.0.0.1:9999/exports/host-readiness");
    assert.equal(requestedUrl, "http://127.0.0.1:9999/exports/host-readiness");
    assert.equal(snapshot.scope, "host_readiness");
    assert.equal(snapshot.overall.statusLabel, "Blocked");
    assert.equal(snapshot.checks[0]?.key, "docker_engine");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) {
      delete process.env.CHAINOPS_API_BASE_URL;
    } else {
      process.env.CHAINOPS_API_BASE_URL = originalBaseUrl;
    }
  }
});
