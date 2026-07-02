import assert from "node:assert/strict";
import type { CaseIncidentSnapshot, WorkspaceIncidentSnapshot } from "./incident-snapshot.ts";
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

  const traceIds = secondWorkspaceSnapshot.visibleCases.map((caseItem) => caseItem.traceId);
  assert.ok(traceIds.includes("trace-demo-provider-timeout"));
  assert.ok(traceIds.includes("trace-demo-pending-high"));
  assert.ok(traceIds.includes("trace-demo-approved-low"));

  assert.deepEqual(
    normalizeWorkspaceSnapshot(firstWorkspaceSnapshot),
    normalizeWorkspaceSnapshot(secondWorkspaceSnapshot)
  );
  assert.deepEqual(normalizeCaseSnapshot(firstCaseSnapshot), normalizeCaseSnapshot(secondCaseSnapshot));

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
