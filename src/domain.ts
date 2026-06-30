import { createHash, randomUUID } from "node:crypto";

export type CaseStatus = "pending_review" | "approved" | "rejected" | "ingestion_failed";
export type RiskLevel = "low" | "medium" | "high";
export type ApprovalDecision = "approve" | "reject";

export type TransactionSample = {
  hash: string;
  direction: "inbound" | "outbound";
  amountEth: number;
  confirmations: number;
  counterparty: string;
};

export type RiskResult = {
  level: RiskLevel;
  score: number;
  indicators: string[];
};

export type SourceMetadata = {
  provider: string;
  mode: "fixture" | "live";
  network: "ethereum-mainnet";
  fetchedAt: string;
  attemptCount: number;
  timeoutMs: number;
  transactionCount: number;
  errorCode?: string;
  retriable?: boolean;
};

export type CaseRecord = {
  id: string;
  walletAddress: string;
  status: CaseStatus;
  risk: RiskResult;
  transactions: TransactionSample[];
  sourceMetadata?: SourceMetadata;
  traceId: string;
  createdAt: string;
  reviewedAt?: string;
  reviewerNote?: string;
};

export type CaseSummary = Pick<
  CaseRecord,
  "id" | "walletAddress" | "status" | "risk" | "sourceMetadata" | "traceId" | "createdAt" | "reviewedAt"
>;

export type CaseListFilters = {
  limit: number;
  status?: CaseStatus;
  riskLevel?: RiskLevel;
  search?: string;
};

export type CaseQueueSummary = {
  total: number;
  pendingReviewCount: number;
  failedIngestionCount: number;
  approvedCount: number;
  rejectedCount: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
};

export type AuditEvent = {
  id: string;
  caseId: string;
  type:
    | "CASE_RECEIVED"
    | "WALLET_VALIDATED"
    | "TRANSACTIONS_INGESTED"
    | "PROVIDER_FETCH_FAILED"
    | "RISK_EVALUATED"
    | "HUMAN_REVIEW_PENDING"
    | "HUMAN_APPROVED"
    | "HUMAN_REJECTED";
  traceId: string;
  at: string;
  details: Record<string, unknown>;
};

export const flaggedWallets = new Set([
  "0x1111111111111111111111111111111111111111",
  "0x9999999999999999999999999999999999999999"
]);

export function normalizeWalletAddress(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("walletAddress must be a string");
  }

  const normalized = value.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) {
    throw new Error("walletAddress must be a 0x-prefixed 40-byte hex address");
  }

  return normalized;
}

export function buildTransactionSample(walletAddress: string): TransactionSample[] {
  const digest = createHash("sha256").update(walletAddress).digest("hex");
  const count = 3;

  return Array.from({ length: count }, (_, index) => {
    const offset = index * 8;
    const amountBasis = Number.parseInt(digest.slice(offset, offset + 4), 16);
    const confirmationBasis = Number.parseInt(digest.slice(offset + 4, offset + 8), 16);

    return {
      hash: `0x${createHash("sha256").update(`${walletAddress}:${index}`).digest("hex")}`,
      direction: index % 2 === 0 ? "inbound" : "outbound",
      amountEth: Number(((amountBasis % 2500) / 100).toFixed(2)),
      confirmations: confirmationBasis % 120,
      counterparty: `0x${digest.slice(0, 40)}`
    };
  });
}

export function evaluateRisk(walletAddress: string, transactions: TransactionSample[]): RiskResult {
  const indicators: string[] = [];
  let score = 0;

  if (flaggedWallets.has(walletAddress)) {
    score += 70;
    indicators.push("wallet appears on the local sanctions-fixture watchlist");
  }

  const totalAmount = transactions.reduce((sum, tx) => sum + tx.amountEth, 0);
  if (totalAmount >= 25) {
    score += 20;
    indicators.push("sampled transfer volume is at or above 25 ETH");
  }

  const lowConfirmationCount = transactions.filter((tx) => tx.confirmations < 12).length;
  if (lowConfirmationCount > 0) {
    score += 10;
    indicators.push("sample includes low-confirmation transactions");
  }

  const level: RiskLevel = score >= 70 ? "high" : score >= 25 ? "medium" : "low";

  if (indicators.length === 0) {
    indicators.push("no deterministic risk indicator fired in the bounded sample");
  }

  return { level, score, indicators };
}

export function createCaseRecord(input: {
  caseId?: string;
  createdAt?: string;
  walletAddress: string;
  transactions: TransactionSample[];
  sourceMetadata: SourceMetadata;
  traceId: string;
  now: string;
}): { caseRecord: CaseRecord; auditEvents: AuditEvent[] } {
  const walletAddress = normalizeWalletAddress(input.walletAddress);
  const transactions = input.transactions;
  const risk = evaluateRisk(walletAddress, transactions);
  const caseId = input.caseId ?? randomUUID();

  const caseRecord: CaseRecord = {
    id: caseId,
    walletAddress,
    status: "pending_review",
    risk,
    transactions,
    sourceMetadata: input.sourceMetadata,
    traceId: input.traceId,
    createdAt: input.createdAt ?? input.now
  };

  const auditEvents = [
    buildAuditEvent(caseId, "CASE_RECEIVED", input.traceId, input.now, { source: "api" }),
    buildAuditEvent(caseId, "WALLET_VALIDATED", input.traceId, input.now, { walletAddress }),
    buildAuditEvent(caseId, "TRANSACTIONS_INGESTED", input.traceId, input.now, {
      source: input.sourceMetadata.provider,
      mode: input.sourceMetadata.mode,
      attemptCount: input.sourceMetadata.attemptCount,
      timeoutMs: input.sourceMetadata.timeoutMs,
      count: transactions.length
    }),
    buildAuditEvent(caseId, "RISK_EVALUATED", input.traceId, input.now, {
      level: risk.level,
      score: risk.score,
      indicators: risk.indicators
    }),
    buildAuditEvent(caseId, "HUMAN_REVIEW_PENDING", input.traceId, input.now, {
      requiredBeforeAction: true
    })
  ];

  return { caseRecord, auditEvents };
}

export function createFailedCaseRecord(input: {
  caseId?: string;
  createdAt?: string;
  walletAddress: string;
  sourceMetadata: SourceMetadata;
  traceId: string;
  now: string;
}): { caseRecord: CaseRecord; auditEvents: AuditEvent[] } {
  const walletAddress = normalizeWalletAddress(input.walletAddress);
  const caseId = input.caseId ?? randomUUID();

  const caseRecord: CaseRecord = {
    id: caseId,
    walletAddress,
    status: "ingestion_failed",
    risk: {
      level: "low",
      score: 0,
      indicators: ["transaction sample unavailable until provider retry succeeds"]
    },
    transactions: [],
    sourceMetadata: input.sourceMetadata,
    traceId: input.traceId,
    createdAt: input.createdAt ?? input.now
  };

  const auditEvents = [
    buildAuditEvent(caseId, "CASE_RECEIVED", input.traceId, input.now, { source: "api" }),
    buildAuditEvent(caseId, "WALLET_VALIDATED", input.traceId, input.now, { walletAddress }),
    buildAuditEvent(caseId, "PROVIDER_FETCH_FAILED", input.traceId, input.now, {
      provider: input.sourceMetadata.provider,
      mode: input.sourceMetadata.mode,
      attemptCount: input.sourceMetadata.attemptCount,
      timeoutMs: input.sourceMetadata.timeoutMs,
      errorCode: input.sourceMetadata.errorCode ?? "unknown",
      retriable: input.sourceMetadata.retriable ?? true
    })
  ];

  return { caseRecord, auditEvents };
}

export function buildAuditEvent(
  caseId: string,
  type: AuditEvent["type"],
  traceId: string,
  at: string,
  details: Record<string, unknown>
): AuditEvent {
  return {
    id: randomUUID(),
    caseId,
    type,
    traceId,
    at,
    details
  };
}

export function normalizeApprovalDecision(value: unknown): ApprovalDecision {
  if (value !== "approve" && value !== "reject") {
    throw new Error("decision must be approve or reject");
  }

  return value;
}
