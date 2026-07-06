import assert from "node:assert/strict";
import type {
  CaseIncidentSnapshot,
  OpenTelemetryExportSnapshot,
  ReleaseRecordSnapshot,
  TelemetryHandoffSnapshot,
  WorkspaceIncidentSnapshot
} from "./incident-snapshot.ts";
import { DEMO_SCENARIO_NAME } from "./demo-scenario.ts";

type DemoResetResponse = {
  scenario: string;
  seededCases: Array<{
    id: string;
    status: string;
    traceId: string;
  }>;
};

export async function runSeededDemoSmokeTest(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<{
  scenario: string;
  failedCaseId: string;
  traceIds: string[];
}> {
  const firstReset = await fetchImpl(`${baseUrl}/demo/reset`, { method: "POST" });
  assert.equal(firstReset.status, 200);
  const firstSeed = (await firstReset.json()) as DemoResetResponse;
  assert.equal(firstSeed.scenario, DEMO_SCENARIO_NAME);
  assert.equal(firstSeed.seededCases.length, 4);

  const failedCaseId = firstSeed.seededCases.find((seededCase) => seededCase.status === "ingestion_failed")?.id;
  assert.ok(failedCaseId);

  const firstWorkspace = await fetchImpl(`${baseUrl}/exports/workspace`);
  assert.equal(firstWorkspace.status, 200);
  const firstWorkspaceSnapshot = (await firstWorkspace.json()) as WorkspaceIncidentSnapshot;
  assert.equal(firstWorkspaceSnapshot.scope, "workspace");
  assert.equal(firstWorkspaceSnapshot.summary.total, 4);
  assert.equal(firstWorkspaceSnapshot.releaseGuide.statusLabel, "Hold");

  const firstCase = await fetchImpl(`${baseUrl}/exports/cases/${failedCaseId}`);
  assert.equal(firstCase.status, 200);
  const firstCaseSnapshot = (await firstCase.json()) as CaseIncidentSnapshot;
  assert.equal(firstCaseSnapshot.scope, "case");
  assert.equal(firstCaseSnapshot.caseRecord.status, "ingestion_failed");
  assert.equal(firstCaseSnapshot.caseRecord.traceId, "trace-demo-provider-timeout");
  assert.equal(firstCaseSnapshot.incidentGuide.statusLabel, "Incident");
  assert.equal(firstCaseSnapshot.stageTrace[1]?.statusLabel, "Failed");
  assert.match(firstCaseSnapshot.providerSummary, /error timeout/);

  const firstTelemetryHandoff = await fetchImpl(`${baseUrl}/exports/telemetry`);
  assert.equal(firstTelemetryHandoff.status, 200);
  const firstTelemetryHandoffSnapshot = (await firstTelemetryHandoff.json()) as TelemetryHandoffSnapshot;
  assert.equal(firstTelemetryHandoffSnapshot.scope, "telemetry_handoff");
  assert.equal(firstTelemetryHandoffSnapshot.service.api.healthPath, "/health");
  assert.equal(firstTelemetryHandoffSnapshot.service.api.releaseRecordPath, "/exports/releases/latest");
  assert.deepEqual(firstTelemetryHandoffSnapshot.seededDemo.expectedTraceIds, [
    "trace-demo-provider-timeout",
    "trace-demo-pending-high",
    "trace-demo-approved-low"
  ]);
  assert.equal(firstTelemetryHandoffSnapshot.queueEvidence.summary.total, 4);
  assert.ok(
    firstTelemetryHandoffSnapshot.queueEvidence.traceSamples.some(
      (traceSample) => traceSample.traceId === "trace-demo-provider-timeout"
    )
  );

  const firstOpenTelemetryExport = await fetchImpl(`${baseUrl}/exports/telemetry/opentelemetry`);
  assert.equal(firstOpenTelemetryExport.status, 200);
  const firstOpenTelemetryExportSnapshot = (await firstOpenTelemetryExport.json()) as OpenTelemetryExportSnapshot;
  assert.equal(firstOpenTelemetryExportSnapshot.scope, "opentelemetry_export");
  assert.equal(firstOpenTelemetryExportSnapshot.resource.serviceName, "chainops-control");
  assert.equal(firstOpenTelemetryExportSnapshot.links.releaseRecordPath, "/exports/releases/latest");
  assert.equal(
    firstOpenTelemetryExportSnapshot.traces.some((trace) => trace.traceId === "trace-demo-provider-timeout"),
    true
  );
  assert.equal(
    firstOpenTelemetryExportSnapshot.metrics.some((metric) => metric.name === "chainops.provider_fetch.duration"),
    true
  );

  const firstReleaseRecord = await fetchImpl(`${baseUrl}/exports/releases/latest`);
  assert.equal(firstReleaseRecord.status, 200);
  const firstReleaseRecordSnapshot = (await firstReleaseRecord.json()) as ReleaseRecordSnapshot;
  assert.equal(firstReleaseRecordSnapshot.scope, "release_record");
  assert.equal(firstReleaseRecordSnapshot.release.statusLabel, "Hold");
  assert.equal(firstReleaseRecordSnapshot.verification.endpoints.releaseRecordPath, "/exports/releases/latest");
  assert.equal(firstReleaseRecordSnapshot.evidence.focusTraceId, "trace-demo-provider-timeout");
  assert.deepEqual(firstReleaseRecordSnapshot.verification.runtimeParity.comparedExports, [
    "/exports/telemetry",
    "/exports/telemetry/opentelemetry",
    "/exports/releases/latest"
  ]);

  await fetchImpl(`${baseUrl}/cases`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ walletAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" })
  });

  const secondReset = await fetchImpl(`${baseUrl}/demo/reset`, { method: "POST" });
  assert.equal(secondReset.status, 200);
  const secondSeed = (await secondReset.json()) as DemoResetResponse;
  assert.equal(secondSeed.seededCases.length, 4);

  const queueAfterReset = await fetchImpl(`${baseUrl}/cases`);
  assert.equal(queueAfterReset.status, 200);
  const queueBody = (await queueAfterReset.json()) as { summary: { total: number } };
  assert.equal(queueBody.summary.total, 4);

  const secondWorkspace = await fetchImpl(`${baseUrl}/exports/workspace`);
  assert.equal(secondWorkspace.status, 200);
  const secondWorkspaceSnapshot = (await secondWorkspace.json()) as WorkspaceIncidentSnapshot;
  const secondCase = await fetchImpl(`${baseUrl}/exports/cases/${failedCaseId}`);
  assert.equal(secondCase.status, 200);
  const secondCaseSnapshot = (await secondCase.json()) as CaseIncidentSnapshot;
  const secondTelemetryHandoff = await fetchImpl(`${baseUrl}/exports/telemetry`);
  assert.equal(secondTelemetryHandoff.status, 200);
  const secondTelemetryHandoffSnapshot = (await secondTelemetryHandoff.json()) as TelemetryHandoffSnapshot;
  const secondOpenTelemetryExport = await fetchImpl(`${baseUrl}/exports/telemetry/opentelemetry`);
  assert.equal(secondOpenTelemetryExport.status, 200);
  const secondOpenTelemetryExportSnapshot = (await secondOpenTelemetryExport.json()) as OpenTelemetryExportSnapshot;
  const secondReleaseRecord = await fetchImpl(`${baseUrl}/exports/releases/latest`);
  assert.equal(secondReleaseRecord.status, 200);
  const secondReleaseRecordSnapshot = (await secondReleaseRecord.json()) as ReleaseRecordSnapshot;

  const traceIds = secondWorkspaceSnapshot.visibleCases.map((caseItem) => caseItem.traceId);
  assert.ok(traceIds.includes("trace-demo-provider-timeout"));
  assert.ok(traceIds.includes("trace-demo-pending-high"));
  assert.ok(traceIds.includes("trace-demo-approved-low"));

  assert.deepEqual(
    normalizeWorkspaceSnapshot(firstWorkspaceSnapshot),
    normalizeWorkspaceSnapshot(secondWorkspaceSnapshot)
  );
  assert.deepEqual(normalizeCaseSnapshot(firstCaseSnapshot), normalizeCaseSnapshot(secondCaseSnapshot));
  assert.deepEqual(
    normalizeReleaseRecordSnapshot(firstReleaseRecordSnapshot),
    normalizeReleaseRecordSnapshot(secondReleaseRecordSnapshot)
  );
  assert.deepEqual(
    normalizeTelemetryHandoffSnapshot(firstTelemetryHandoffSnapshot),
    normalizeTelemetryHandoffSnapshot(secondTelemetryHandoffSnapshot)
  );
  assert.deepEqual(
    normalizeOpenTelemetryExportSnapshot(firstOpenTelemetryExportSnapshot),
    normalizeOpenTelemetryExportSnapshot(secondOpenTelemetryExportSnapshot)
  );

  return {
    scenario: secondSeed.scenario,
    failedCaseId,
    traceIds
  };
}

function normalizeWorkspaceSnapshot(snapshot: WorkspaceIncidentSnapshot) {
  return {
    ...snapshot,
    generatedAt: "<ignored>",
    analytics: {
      ...snapshot.analytics,
      reviewLatency: {
        ...snapshot.analytics.reviewLatency,
        oldestPendingHours: "<ignored>"
      }
    },
    releaseGuide: {
      ...snapshot.releaseGuide,
      evidence: snapshot.releaseGuide.evidence.map((item) =>
        item.startsWith("Oldest pending review age: ") ? "Oldest pending review age: <ignored> hours." : item
      )
    }
  };
}

function normalizeCaseSnapshot(snapshot: CaseIncidentSnapshot) {
  return {
    ...snapshot,
    generatedAt: "<ignored>"
  };
}

function normalizeReleaseRecordSnapshot(snapshot: ReleaseRecordSnapshot) {
  return {
    ...snapshot,
    generatedAt: "<ignored>",
    verification: {
      ...snapshot.verification,
      hostReadiness: snapshot.verification.hostReadiness.lastResult
        ? {
            ...snapshot.verification.hostReadiness,
            lastResult: {
              ...snapshot.verification.hostReadiness.lastResult,
              generatedAt: "<ignored>"
            }
          }
        : snapshot.verification.hostReadiness
    },
    evidence: {
      ...snapshot.evidence,
      analytics: {
        ...snapshot.evidence.analytics,
        reviewLatency: {
          ...snapshot.evidence.analytics.reviewLatency,
          oldestPendingHours: "<ignored>"
        }
      },
      releaseGuide: {
        ...snapshot.evidence.releaseGuide,
        evidence: snapshot.evidence.releaseGuide.evidence.map((item) =>
          item.startsWith("Oldest pending review age: ") ? "Oldest pending review age: <ignored> hours." : item
        )
      }
    },
    rollback: {
      ...snapshot.rollback,
      evidence: snapshot.rollback.evidence.map((item) =>
        item.startsWith("Oldest pending review age: ") ? "Oldest pending review age: <ignored> hours." : item
      )
    }
  };
}

function normalizeTelemetryHandoffSnapshot(snapshot: TelemetryHandoffSnapshot) {
  return {
    ...snapshot,
    generatedAt: "<ignored>",
    queueEvidence: {
      ...snapshot.queueEvidence,
      analytics: {
        ...snapshot.queueEvidence.analytics,
        reviewLatency: {
          ...snapshot.queueEvidence.analytics.reviewLatency,
          oldestPendingHours: "<ignored>"
        }
      },
      releaseGuide: {
        ...snapshot.queueEvidence.releaseGuide,
        evidence: snapshot.queueEvidence.releaseGuide.evidence.map((item) =>
          item.startsWith("Oldest pending review age: ") ? "Oldest pending review age: <ignored> hours." : item
        )
      }
    }
  };
}

function normalizeOpenTelemetryExportSnapshot(snapshot: OpenTelemetryExportSnapshot) {
  return {
    ...snapshot,
    generatedAt: "<ignored>"
  };
}
