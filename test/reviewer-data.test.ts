import assert from "node:assert/strict";
import test from "node:test";
import { fetchLatestReleaseRecord } from "../src/reviewer-data.ts";

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
            releaseRecordPath: "/exports/releases/latest"
          },
          seededScenario: {
            name: "incident_review_v1",
            expectedTraceIds: ["trace-demo-provider-timeout"]
          },
          runtimeParity: {
            comparedExports: ["/exports/telemetry", "/exports/releases/latest"],
            ignoredFields: ["generatedAt"],
            failureMode: "Treat the runtime as stale.",
            lastResult: null,
            reviewArtifact: null
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
