import type { AuditEvent, CaseRecord, CaseStatus, SourceMetadata } from "./domain.ts";
import { buildTransactionSample, createCaseRecord, createFailedCaseRecord } from "./domain.ts";

export const DEMO_SCENARIO_NAME = "incident_review_v1" as const;

export type DemoScenarioName = typeof DEMO_SCENARIO_NAME;

export type DemoSeedCase = {
  label: string;
  idempotencyKey?: string;
  caseRecord: CaseRecord;
  auditEvents: AuditEvent[];
};

export type DemoScenario = {
  name: DemoScenarioName;
  title: string;
  description: string;
  cases: DemoSeedCase[];
  notes: string[];
};

export function buildDemoScenario(name: DemoScenarioName = DEMO_SCENARIO_NAME): DemoScenario {
  if (name !== DEMO_SCENARIO_NAME) {
    throw new Error(`unknown demo scenario: ${name}`);
  }

  const pendingCase = createCaseRecord({
    caseId: "11111111-1111-4111-8111-111111111111",
    createdAt: "2026-07-02T15:00:00.000Z",
    walletAddress: "0x1111111111111111111111111111111111111111",
    transactions: buildTransactionSample("0x1111111111111111111111111111111111111111"),
    sourceMetadata: buildFixtureSourceMetadata("2026-07-02T15:00:00.000Z", 3),
    traceId: "trace-demo-pending-high",
    now: "2026-07-02T15:00:00.000Z",
    providerFetchDurationMs: 420,
    intakeDurationMs: 760
  });

  const approvedBase = createCaseRecord({
    caseId: "22222222-2222-4222-8222-222222222222",
    createdAt: "2026-07-02T12:15:00.000Z",
    walletAddress: "0x2222222222222222222222222222222222222222",
    transactions: buildTransactionSample("0x2222222222222222222222222222222222222222"),
    sourceMetadata: buildFixtureSourceMetadata("2026-07-02T12:15:00.000Z", 3),
    traceId: "trace-demo-approved-low",
    now: "2026-07-02T12:15:00.000Z",
    providerFetchDurationMs: 180,
    intakeDurationMs: 310
  });

  const rejectedBase = createCaseRecord({
    caseId: "33333333-3333-4333-8333-333333333333",
    createdAt: "2026-07-02T13:40:00.000Z",
    walletAddress: "0x5555555555555555555555555555555555555555",
    transactions: buildTransactionSample("0x5555555555555555555555555555555555555555"),
    sourceMetadata: buildFixtureSourceMetadata("2026-07-02T13:40:00.000Z", 3),
    traceId: "trace-demo-rejected-medium",
    now: "2026-07-02T13:40:00.000Z",
    providerFetchDurationMs: 260,
    intakeDurationMs: 490
  });

  const failedCase = createFailedCaseRecord({
    caseId: "44444444-4444-4444-8444-444444444444",
    createdAt: "2026-07-02T15:20:00.000Z",
    walletAddress: "0x9999999999999999999999999999999999999999",
    sourceMetadata: {
      provider: "etherscan-account-txlist",
      mode: "live",
      network: "ethereum-mainnet",
      fetchedAt: "2026-07-02T15:20:00.000Z",
      attemptCount: 2,
      timeoutMs: 1200,
      transactionCount: 0,
      errorCode: "timeout",
      retriable: true
    },
    traceId: "trace-demo-provider-timeout",
    now: "2026-07-02T15:20:00.000Z",
    providerFetchDurationMs: 1200,
    intakeDurationMs: 1500
  });

  return {
    name,
    title: "Incident review demo",
    description:
      "Resets the local dataset to one failed-ingestion incident, one pending high-risk case, and two completed reviewer decisions with stable trace IDs.",
    cases: [
      {
        label: "Pending high-risk fixture review",
        idempotencyKey: "demo-pending-high",
        caseRecord: pendingCase.caseRecord,
        auditEvents: pendingCase.auditEvents.map((event, index) =>
          createSeedAuditEvent(pendingCase.caseRecord.id, index + 1, event.type, event.traceId, event.at, event.details)
        )
      },
      buildReviewedSeedCase({
        label: "Approved fixture baseline",
        seedPrefix: "approved-low",
        base: approvedBase,
        status: "approved",
        reviewedAt: "2026-07-02T13:05:00.000Z",
        reviewerNote: "Approved after comparing the bounded fixture sample with the expected low-risk baseline.",
        decisionDurationMs: 540
      }),
      buildReviewedSeedCase({
        label: "Rejected suspicious fixture",
        seedPrefix: "rejected-medium",
        base: rejectedBase,
        status: "rejected",
        reviewedAt: "2026-07-02T14:25:00.000Z",
        reviewerNote: "Rejected because the sampled activity deviated from the expected fixture pattern and needs follow-up.",
        decisionDurationMs: 620
      }),
      {
        label: "Provider timeout incident",
        idempotencyKey: "demo-provider-timeout",
        caseRecord: failedCase.caseRecord,
        auditEvents: failedCase.auditEvents.map((event, index) =>
          createSeedAuditEvent(failedCase.caseRecord.id, index + 1, event.type, event.traceId, event.at, event.details)
        )
      }
    ],
    notes: [
      "Workspace and case exports should keep the same seeded case IDs, trace IDs, statuses, notes, and stage durations after each reset.",
      "The export timestamp and current pending-review age are expected to move with the moment the reset is run."
    ]
  };
}

function buildFixtureSourceMetadata(fetchedAt: string, transactionCount: number): SourceMetadata {
  return {
    provider: "deterministic-fixture",
    mode: "fixture",
    network: "ethereum-mainnet",
    fetchedAt,
    attemptCount: 1,
    timeoutMs: 0,
    transactionCount
  };
}

function buildReviewedSeedCase(input: {
  label: string;
  seedPrefix: string;
  base: { caseRecord: CaseRecord; auditEvents: AuditEvent[] };
  status: Extract<CaseStatus, "approved" | "rejected">;
  reviewedAt: string;
  reviewerNote: string;
  decisionDurationMs: number;
}): DemoSeedCase {
  const decisionType = input.status === "approved" ? "HUMAN_APPROVED" : "HUMAN_REJECTED";

  return {
    label: input.label,
    idempotencyKey: `demo-${input.seedPrefix}`,
    caseRecord: {
      ...input.base.caseRecord,
      status: input.status,
      reviewedAt: input.reviewedAt,
      reviewerNote: input.reviewerNote
    },
    auditEvents: [
      ...input.base.auditEvents.map((event, index) =>
        createSeedAuditEvent(
          input.base.caseRecord.id,
          index + 1,
          event.type,
          event.traceId,
          event.at,
          event.details
        )
      ),
      createSeedAuditEvent(
        input.base.caseRecord.id,
        6,
        decisionType,
        input.base.caseRecord.traceId,
        input.reviewedAt,
        {
          note: input.reviewerNote,
          durationMs: input.decisionDurationMs
        }
      )
    ]
  };
}

function createSeedAuditEvent(
  caseId: string,
  order: number,
  type: AuditEvent["type"],
  traceId: string,
  at: string,
  details: Record<string, unknown>
): AuditEvent {
  return {
    id: buildSeedUuid(caseId, order),
    caseId,
    type,
    traceId,
    at,
    details
  };
}

function buildSeedUuid(caseId: string, order: number): string {
  const suffix = order.toString(16).padStart(12, "0");
  return `${caseId.slice(0, 23)}${suffix}`;
}
