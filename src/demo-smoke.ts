import assert from "node:assert/strict";
import type {
  CaseIncidentSnapshot,
  OpenTelemetryExportSnapshot,
  ReleaseRecordSnapshot,
  TelemetryHandoffSnapshot,
  WorkspaceIncidentSnapshot
} from "./incident-snapshot.ts";
import { DEMO_SCENARIO_NAME } from "./demo-scenario.ts";
import type { RuntimeParityFocusCaseReplay } from "./runtime-parity.ts";

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
  replayFailedCaseId: string;
  replayRecoveredCaseId: string;
  traceIds: string[];
  focusCaseReplay: RuntimeParityFocusCaseReplay;
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
  assert.equal(firstReleaseRecordSnapshot.verification.seededReplay.actionPathTemplate, "/cases/:id/replay");
  assert.equal(firstReleaseRecordSnapshot.evidence.focusTraceId, "trace-demo-provider-timeout");
  assert.equal(firstReleaseRecordSnapshot.evidence.replay.status, "not_attempted");
  assert.deepEqual(firstReleaseRecordSnapshot.verification.runtimeParity.comparedExports, [
    "/exports/telemetry",
    "/exports/telemetry/opentelemetry",
    "/exports/releases/latest"
  ]);

  const failedReplayResponse = await fetchImpl(`${baseUrl}/cases/${failedCaseId}/replay`, {
    method: "POST",
    headers: {
      "x-request-id": "trace-demo-replay-failed-1"
    }
  });
  assert.equal(failedReplayResponse.status, 200);
  const failedReplayBody = (await failedReplayResponse.json()) as {
    recovered: boolean;
    replayAttempt: number;
    caseRecord: {
      id: string;
      status: string;
      traceId: string;
    };
  };
  assert.equal(failedReplayBody.recovered, false);
  assert.equal(failedReplayBody.replayAttempt, 1);
  assert.equal(failedReplayBody.caseRecord.id, failedCaseId);
  assert.equal(failedReplayBody.caseRecord.status, "ingestion_failed");
  assert.equal(failedReplayBody.caseRecord.traceId, "trace-demo-replay-failed-1");

  const failedReplayCaseResponse = await fetchImpl(`${baseUrl}/exports/cases/${failedCaseId}`);
  assert.equal(failedReplayCaseResponse.status, 200);
  const failedReplayCaseSnapshot = (await failedReplayCaseResponse.json()) as CaseIncidentSnapshot;
  assert.equal(failedReplayCaseSnapshot.caseRecord.status, "ingestion_failed");
  assert.equal(failedReplayCaseSnapshot.caseRecord.traceId, "trace-demo-replay-failed-1");
  assert.equal(
    failedReplayCaseSnapshot.auditEvents.some((event) => event.type === "FAILED_CASE_REPLAY_REQUESTED"),
    true
  );
  assert.equal(
    failedReplayCaseSnapshot.auditEvents.some((event) => event.type === "FAILED_CASE_REPLAY_FAILED"),
    true
  );
  assert.match(
    failedReplayCaseSnapshot.incidentGuide.evidence.join(" "),
    /replay attempt 1/i
  );
  assert.match(
    failedReplayCaseSnapshot.incidentGuide.evidence.join(" "),
    /repeated the failure/i
  );

  const releaseRecordAfterFailedReplay = await fetchImpl(`${baseUrl}/exports/releases/latest`);
  assert.equal(releaseRecordAfterFailedReplay.status, 200);
  const failedReplayReleaseRecordSnapshot = (await releaseRecordAfterFailedReplay.json()) as ReleaseRecordSnapshot;
  assert.equal(failedReplayReleaseRecordSnapshot.evidence.focusCasePath, `/cases/${failedCaseId}`);
  assert.equal(failedReplayReleaseRecordSnapshot.evidence.focusTraceId, "trace-demo-replay-failed-1");
  assert.equal(failedReplayReleaseRecordSnapshot.evidence.replay.status, "failed_again");
  assert.equal(failedReplayReleaseRecordSnapshot.evidence.replay.replayAttempt, 1);
  assert.equal(failedReplayReleaseRecordSnapshot.evidence.replay.casePath, `/cases/${failedCaseId}`);
  assert.equal(failedReplayReleaseRecordSnapshot.evidence.replay.traceId, "trace-demo-replay-failed-1");
  assert.equal(failedReplayReleaseRecordSnapshot.evidence.replay.history.length, 1);
  assert.equal(failedReplayReleaseRecordSnapshot.evidence.replay.history[0]?.status, "failed_again");
  assert.equal(failedReplayReleaseRecordSnapshot.evidence.replay.history[0]?.traceId, "trace-demo-replay-failed-1");
  assert.match(failedReplayReleaseRecordSnapshot.evidence.replay.summary, /latest provider fetch still ended in timeout/i);

  const recoveredReplayResponse = await fetchImpl(`${baseUrl}/cases/${failedCaseId}/replay`, {
    method: "POST",
    headers: {
      "x-request-id": "trace-demo-replay-recovered-2"
    }
  });
  assert.equal(recoveredReplayResponse.status, 200);
  const recoveredReplayBody = (await recoveredReplayResponse.json()) as {
    recovered: boolean;
    replayAttempt: number;
    caseRecord: {
      id: string;
      status: string;
      traceId: string;
    };
  };
  assert.equal(recoveredReplayBody.recovered, true);
  assert.equal(recoveredReplayBody.replayAttempt, 2);
  assert.equal(recoveredReplayBody.caseRecord.id, failedCaseId);
  assert.equal(recoveredReplayBody.caseRecord.status, "pending_review");
  assert.equal(recoveredReplayBody.caseRecord.traceId, "trace-demo-replay-recovered-2");

  const replayedCaseResponse = await fetchImpl(`${baseUrl}/exports/cases/${failedCaseId}`);
  assert.equal(replayedCaseResponse.status, 200);
  const replayedCaseSnapshot = (await replayedCaseResponse.json()) as CaseIncidentSnapshot;
  assert.equal(replayedCaseSnapshot.caseRecord.status, "pending_review");
  assert.equal(replayedCaseSnapshot.caseRecord.traceId, "trace-demo-replay-recovered-2");
  assert.equal(
    replayedCaseSnapshot.auditEvents.some((event) => event.type === "FAILED_CASE_REPLAY_RECOVERED"),
    true
  );
  assert.match(
    replayedCaseSnapshot.incidentGuide.evidence.join(" "),
    /Recovered on replay attempt 2 with the original idempotency key/i
  );

  const releaseRecordAfterReplay = await fetchImpl(`${baseUrl}/exports/releases/latest`);
  assert.equal(releaseRecordAfterReplay.status, 200);
  const replayReleaseRecordSnapshot = (await releaseRecordAfterReplay.json()) as ReleaseRecordSnapshot;
  assert.equal(replayReleaseRecordSnapshot.evidence.focusCasePath, `/cases/${failedCaseId}`);
  assert.equal(replayReleaseRecordSnapshot.evidence.focusTraceId, "trace-demo-replay-recovered-2");
  assert.equal(replayReleaseRecordSnapshot.evidence.replay.status, "recovered");
  assert.equal(replayReleaseRecordSnapshot.evidence.replay.replayAttempt, 2);
  assert.equal(replayReleaseRecordSnapshot.evidence.replay.casePath, `/cases/${failedCaseId}`);
  assert.equal(replayReleaseRecordSnapshot.evidence.replay.traceId, "trace-demo-replay-recovered-2");
  assert.equal(replayReleaseRecordSnapshot.evidence.replay.history.length, 2);
  assert.equal(replayReleaseRecordSnapshot.evidence.replay.history[0]?.status, "failed_again");
  assert.equal(replayReleaseRecordSnapshot.evidence.replay.history[1]?.status, "recovered");
  assert.match(replayReleaseRecordSnapshot.evidence.replay.summary, /recovered this case/i);

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
    replayFailedCaseId: failedReplayBody.caseRecord.id,
    replayRecoveredCaseId: recoveredReplayBody.caseRecord.id,
    traceIds,
    focusCaseReplay: {
      caseId: failedCaseId,
      casePath: replayReleaseRecordSnapshot.evidence.replay.casePath ?? `/cases/${failedCaseId}`,
      caseExportPath: replayReleaseRecordSnapshot.evidence.replay.caseExportPath ?? `/exports/cases/${failedCaseId}`,
      traceId: replayReleaseRecordSnapshot.evidence.replay.traceId,
      status: replayReleaseRecordSnapshot.evidence.replay.status,
      replayAttempt: replayReleaseRecordSnapshot.evidence.replay.replayAttempt,
      summary: replayReleaseRecordSnapshot.evidence.replay.summary,
      history: replayReleaseRecordSnapshot.evidence.replay.history
    }
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
