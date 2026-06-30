import { Pool, type PoolClient } from "pg";
import {
  type ApprovalDecision,
  type AuditEvent,
  buildAuditEvent,
  type CaseQueueAnalytics,
  type CaseListFilters,
  type CaseRecord,
  type CaseQueueSummary,
  type CaseStatusTransitionCounts,
  type CaseTimelinePoint,
  type CaseSummary,
  createCaseRecord,
  createFailedCaseRecord,
  normalizeWalletAddress,
  type ReviewLatencySummary,
  type SourceMetadata,
  type TransactionSample
} from "./domain.ts";
import {
  FixtureTransactionProvider,
  ProviderFetchError,
  type TransactionProvider
} from "./provider.ts";

type CaseRow = {
  id: string;
  wallet_address: string;
  status: CaseRecord["status"];
  risk_level: CaseRecord["risk"]["level"];
  risk_score: number;
  risk_indicators: string[];
  trace_id: string;
  created_at: string;
  reviewed_at: string | null;
  reviewer_note: string | null;
  idempotency_key: string | null;
  source_metadata: SourceMetadata | null;
};

type TransactionRow = {
  tx_hash: string;
  direction: TransactionSample["direction"];
  amount_eth: string;
  confirmations: number;
  counterparty: string;
  position: number;
};

type AuditEventRow = {
  id: string;
  case_id: string;
  event_type: AuditEvent["type"];
  trace_id: string;
  at: string;
  details: Record<string, unknown>;
};

type StoredCaseBundle = {
  caseRecord: CaseRecord;
  auditEvents: AuditEvent[];
};

type CaseSummaryCountRow = {
  total: string;
  pending_review_count: string;
  failed_ingestion_count: string;
  approved_count: string;
  rejected_count: string;
  high_risk_count: string;
  medium_risk_count: string;
  low_risk_count: string;
};

type TransitionCountRow = {
  entered_review_count: string;
  approved_count: string;
  rejected_count: string;
  failed_ingestion_count: string;
};

type ReviewLatencyRow = {
  reviewed_count: string;
  average_hours: string | null;
  max_hours: string | null;
  oldest_pending_hours: string | null;
};

type TimelineCaseRow = {
  created_at: string;
  reviewed_at: string | null;
  status: CaseRecord["status"];
};

export type AuditStore = {
  init(): Promise<void>;
  close(): Promise<void>;
  health(): Promise<{ ok: true; caseCount: number; auditEventCount: number }>;
  listCases(filters?: Partial<CaseListFilters>): Promise<{
    cases: CaseSummary[];
    summary: CaseQueueSummary;
    analytics: CaseQueueAnalytics;
    filters: CaseListFilters;
  }>;
  createCase(input: {
    walletAddress: string;
    traceId: string;
    now: string;
    idempotencyKey?: string;
  }): Promise<{ caseRecord: CaseRecord; auditEvents: AuditEvent[]; replayed: boolean; recovered: boolean }>;
  approveCase(input: {
    caseId: string;
    decision: ApprovalDecision;
    traceId: string;
    now: string;
    note?: string;
  }): Promise<{ caseRecord: CaseRecord; auditEvent: AuditEvent }>;
  findCase(caseId: string): Promise<{ caseRecord: CaseRecord; auditEvents: AuditEvent[] } | null>;
};

export class PostgresAuditStore implements AuditStore {
  private readonly pool: Pool;
  private readonly schema: string;
  private readonly initPromise: Promise<void>;
  private readonly provider: TransactionProvider;

  constructor(
    databaseUrlOrOptions:
      | string
      | { databaseUrl?: string; pool?: Pool; schema?: string; provider?: TransactionProvider },
    schema = "public"
  ) {
    const databaseUrl =
      typeof databaseUrlOrOptions === "string" ? databaseUrlOrOptions : databaseUrlOrOptions.databaseUrl;
    const providedPool = typeof databaseUrlOrOptions === "string" ? undefined : databaseUrlOrOptions.pool;
    const resolvedSchema = typeof databaseUrlOrOptions === "string" ? schema : databaseUrlOrOptions.schema ?? "public";
    const provider =
      typeof databaseUrlOrOptions === "string" ? undefined : databaseUrlOrOptions.provider;

    if (!databaseUrl && !providedPool) {
      throw new Error("databaseUrl or pool is required");
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(resolvedSchema)) {
      throw new Error("schema must contain only letters, numbers, and underscores");
    }

    this.pool = providedPool ?? new Pool({ connectionString: databaseUrl });
    this.schema = resolvedSchema;
    this.provider = provider ?? new FixtureTransactionProvider();
    this.initPromise = this.initialize();
  }

  async init(): Promise<void> {
    await this.initPromise;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async health(): Promise<{ ok: true; caseCount: number; auditEventCount: number }> {
    await this.initPromise;
    const client = await this.pool.connect();

    try {
      const caseCountResult = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM ${this.schema}.cases`
      );
      const auditCountResult = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM ${this.schema}.audit_events`
      );

      return {
        ok: true,
        caseCount: Number(caseCountResult.rows[0].count),
        auditEventCount: Number(auditCountResult.rows[0].count)
      };
    } finally {
      client.release();
    }
  }

  async listCases(filters: Partial<CaseListFilters> = {}): Promise<{
    cases: CaseSummary[];
    summary: CaseQueueSummary;
    analytics: CaseQueueAnalytics;
    filters: CaseListFilters;
  }> {
    await this.initPromise;
    const client = await this.pool.connect();
    const normalizedFilters = normalizeCaseListFilters(filters);

    try {
      const where = buildCaseListWhereClause(normalizedFilters);
      const countResult = await client.query<CaseSummaryCountRow>(
        `SELECT COUNT(*) AS total,
                COALESCE(SUM(CASE WHEN status = 'pending_review' THEN 1 ELSE 0 END), 0) AS pending_review_count,
                COALESCE(SUM(CASE WHEN status = 'ingestion_failed' THEN 1 ELSE 0 END), 0) AS failed_ingestion_count,
                COALESCE(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END), 0) AS approved_count,
                COALESCE(SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END), 0) AS rejected_count,
                COALESCE(SUM(CASE WHEN risk_level = 'high' THEN 1 ELSE 0 END), 0) AS high_risk_count,
                COALESCE(SUM(CASE WHEN risk_level = 'medium' THEN 1 ELSE 0 END), 0) AS medium_risk_count,
                COALESCE(SUM(CASE WHEN risk_level = 'low' THEN 1 ELSE 0 END), 0) AS low_risk_count
         FROM ${this.schema}.cases
         ${where.sql}`,
        where.values
      );
      const caseResult = await client.query<CaseRow>(
        `SELECT *
         FROM ${this.schema}.cases
         ${where.sql}
         ORDER BY created_at DESC
         LIMIT $1`,
        [...where.values, normalizedFilters.limit]
      );

      return {
        cases: caseResult.rows.map(mapCaseSummaryRow),
        summary: mapCaseSummaryCountRow(countResult.rows[0]),
        analytics: await this.loadCaseQueueAnalytics(client, normalizedFilters),
        filters: normalizedFilters
      };
    } finally {
      client.release();
    }
  }

  async createCase(input: {
    walletAddress: string;
    traceId: string;
    now: string;
    idempotencyKey?: string;
  }): Promise<{ caseRecord: CaseRecord; auditEvents: AuditEvent[]; replayed: boolean; recovered: boolean }> {
    await this.initPromise;
    const walletAddress = normalizeWalletAddress(input.walletAddress);
    const existing = input.idempotencyKey
      ? await this.findCaseByIdempotencyKey(input.idempotencyKey)
      : null;

    if (existing && existing.caseRecord.status !== "ingestion_failed") {
      return { ...existing, replayed: true, recovered: false };
    }

    try {
      const providerResult = await this.provider.fetchTransactionSample({
        walletAddress,
        traceId: input.traceId
      });
      const created = createCaseRecord({
        caseId: existing?.caseRecord.id,
        createdAt: existing?.caseRecord.createdAt,
        walletAddress,
        transactions: providerResult.transactions,
        sourceMetadata: providerResult.sourceMetadata,
        traceId: input.traceId,
        now: input.now
      });

      if (existing) {
        return await this.recoverFailedCase(created);
      }

      return await this.insertCase(created, input.idempotencyKey);
    } catch (error) {
      const providerError = normalizeProviderFetchError(error);
      const sourceMetadata = buildFailureSourceMetadata(providerError, input.now);
      const failed = createFailedCaseRecord({
        caseId: existing?.caseRecord.id,
        createdAt: existing?.caseRecord.createdAt,
        walletAddress,
        sourceMetadata,
        traceId: input.traceId,
        now: input.now
      });

      if (existing) {
        return await this.recordFailedRetry(failed);
      }

      return await this.insertCase(failed, input.idempotencyKey);
    }
  }

  async approveCase(input: {
    caseId: string;
    decision: ApprovalDecision;
    traceId: string;
    now: string;
    note?: string;
  }): Promise<{ caseRecord: CaseRecord; auditEvent: AuditEvent }> {
    await this.initPromise;
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const caseResult = await client.query<CaseRow>(
        `SELECT * FROM ${this.schema}.cases WHERE id = $1 FOR UPDATE`,
        [input.caseId]
      );

      if (!caseResult.rowCount) {
        throw new Error("case not found");
      }

      const caseRow = caseResult.rows[0];
      if (caseRow.status !== "pending_review") {
        throw new Error("case is no longer pending review");
      }

      const nextStatus = input.decision === "approve" ? "approved" : "rejected";
      await client.query(
        `UPDATE ${this.schema}.cases
         SET status = $2, reviewed_at = $3::timestamptz, reviewer_note = $4
         WHERE id = $1`,
        [input.caseId, nextStatus, input.now, input.note ?? null]
      );

      const auditEvent = buildAuditEvent(
        input.caseId,
        input.decision === "approve" ? "HUMAN_APPROVED" : "HUMAN_REJECTED",
        input.traceId,
        input.now,
        { note: input.note ?? null }
      );

      await this.insertAuditEvents(client, [auditEvent]);
      const found = await this.findCaseWithClient(client, input.caseId);
      await client.query("COMMIT");

      if (!found) {
        throw new Error("case not found");
      }

      return { caseRecord: found.caseRecord, auditEvent };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async findCase(caseId: string): Promise<{ caseRecord: CaseRecord; auditEvents: AuditEvent[] } | null> {
    await this.initPromise;
    const client = await this.pool.connect();

    try {
      return await this.findCaseWithClient(client, caseId);
    } finally {
      client.release();
    }
  }

  private async initialize(): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${this.schema}`);
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${this.schema}.cases (
          id UUID PRIMARY KEY,
          wallet_address TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('pending_review', 'approved', 'rejected', 'ingestion_failed')),
          risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
          risk_score INTEGER NOT NULL,
          risk_indicators JSONB NOT NULL,
          trace_id TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL,
          reviewed_at TIMESTAMPTZ,
          reviewer_note TEXT,
          idempotency_key TEXT UNIQUE,
          source_metadata JSONB
        )
      `);
      await client.query(`ALTER TABLE ${this.schema}.cases ADD COLUMN IF NOT EXISTS source_metadata JSONB`);
      await client.query(`ALTER TABLE ${this.schema}.cases DROP CONSTRAINT IF EXISTS cases_status_check`);
      await client.query(`
        ALTER TABLE ${this.schema}.cases
        ADD CONSTRAINT cases_status_check
        CHECK (status IN ('pending_review', 'approved', 'rejected', 'ingestion_failed'))
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${this.schema}.transactions (
          case_id UUID NOT NULL REFERENCES ${this.schema}.cases(id) ON DELETE CASCADE,
          tx_hash TEXT NOT NULL,
          direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
          amount_eth NUMERIC(18, 2) NOT NULL,
          confirmations INTEGER NOT NULL,
          counterparty TEXT NOT NULL,
          position INTEGER NOT NULL,
          PRIMARY KEY (case_id, position)
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${this.schema}.audit_events (
          id UUID PRIMARY KEY,
          case_id UUID NOT NULL REFERENCES ${this.schema}.cases(id) ON DELETE CASCADE,
          event_type TEXT NOT NULL,
          trace_id TEXT NOT NULL,
          at TIMESTAMPTZ NOT NULL,
          details JSONB NOT NULL
        )
      `);
      await client.query(
        `CREATE INDEX IF NOT EXISTS cases_wallet_address_idx ON ${this.schema}.cases (wallet_address)`
      );
      await client.query(
        `CREATE INDEX IF NOT EXISTS audit_events_case_id_idx ON ${this.schema}.audit_events (case_id, at)`
      );
    } finally {
      client.release();
    }
  }

  private async findCaseWithClient(
    client: PoolClient,
    caseId: string
  ): Promise<{ caseRecord: CaseRecord; auditEvents: AuditEvent[] } | null> {
    const caseResult = await client.query<CaseRow>(
      `SELECT * FROM ${this.schema}.cases WHERE id = $1`,
      [caseId]
    );

    if (!caseResult.rowCount) {
      return null;
    }

    const transactionResult = await client.query<TransactionRow>(
      `SELECT tx_hash, direction, amount_eth, confirmations, counterparty, position
       FROM ${this.schema}.transactions
       WHERE case_id = $1
       ORDER BY position ASC`,
      [caseId]
    );
    const auditEventResult = await client.query<AuditEventRow>(
      `SELECT id, case_id, event_type, trace_id, at, details
       FROM ${this.schema}.audit_events
       WHERE case_id = $1
       ORDER BY at ASC, id ASC`,
      [caseId]
    );

    return {
      caseRecord: mapCaseRow(caseResult.rows[0], transactionResult.rows),
      auditEvents: auditEventResult.rows.map(mapAuditEventRow)
    };
  }

  private async findCaseByIdempotencyKey(idempotencyKey: string): Promise<StoredCaseBundle | null> {
    const client = await this.pool.connect();

    try {
      const existingResult = await client.query<{ id: string }>(
        `SELECT id FROM ${this.schema}.cases WHERE idempotency_key = $1`,
        [idempotencyKey]
      );

      if (!existingResult.rowCount) {
        return null;
      }

      return await this.findCaseWithClient(client, existingResult.rows[0].id);
    } finally {
      client.release();
    }
  }

  private async loadCaseQueueAnalytics(
    client: PoolClient,
    filters: CaseListFilters
  ): Promise<CaseQueueAnalytics> {
    const where = buildCaseListWhereClause(filters);
    const transitionResult = await client.query<TransitionCountRow>(
      `WITH filtered_cases AS (
         SELECT id
         FROM ${this.schema}.cases
         ${where.sql}
       )
       SELECT COALESCE(SUM(CASE WHEN event_type = 'HUMAN_REVIEW_PENDING' THEN 1 ELSE 0 END), 0) AS entered_review_count,
              COALESCE(SUM(CASE WHEN event_type = 'HUMAN_APPROVED' THEN 1 ELSE 0 END), 0) AS approved_count,
              COALESCE(SUM(CASE WHEN event_type = 'HUMAN_REJECTED' THEN 1 ELSE 0 END), 0) AS rejected_count,
              COALESCE(SUM(CASE WHEN event_type = 'PROVIDER_FETCH_FAILED' THEN 1 ELSE 0 END), 0) AS failed_ingestion_count
       FROM ${this.schema}.audit_events
       WHERE case_id IN (SELECT id FROM filtered_cases)`,
      where.values
    );
    const latencyResult = await client.query<ReviewLatencyRow>(
      `WITH filtered_cases AS (
         SELECT created_at, reviewed_at, status
         FROM ${this.schema}.cases
         ${where.sql}
       )
       SELECT COALESCE(SUM(CASE WHEN reviewed_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS reviewed_count,
              AVG((EXTRACT(EPOCH FROM reviewed_at) - EXTRACT(EPOCH FROM created_at)) / 3600.0) AS average_hours,
              MAX((EXTRACT(EPOCH FROM reviewed_at) - EXTRACT(EPOCH FROM created_at)) / 3600.0) AS max_hours,
              MAX(CASE
                    WHEN status = 'pending_review'
                    THEN (EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) - EXTRACT(EPOCH FROM created_at)) / 3600.0
                    ELSE NULL
                  END) AS oldest_pending_hours
       FROM filtered_cases`,
      where.values
    );
    const timelineRows = await client.query<TimelineCaseRow>(
      `SELECT created_at, reviewed_at, status
       FROM ${this.schema}.cases
       ${where.sql}
       ORDER BY created_at DESC
       LIMIT 200`,
      where.values
    );

    return {
      statusTransitions: mapTransitionCountRow(transitionResult.rows[0]),
      reviewLatency: mapReviewLatencyRow(latencyResult.rows[0]),
      timeline: buildTimelineFromCaseRows(timelineRows.rows)
    };
  }

  private async insertCase(
    created: StoredCaseBundle,
    idempotencyKey?: string
  ): Promise<{ caseRecord: CaseRecord; auditEvents: AuditEvent[]; replayed: boolean; recovered: boolean }> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      await this.insertCaseRow(client, created.caseRecord, idempotencyKey);
      await this.replaceTransactions(client, created.caseRecord.id, created.caseRecord.transactions);
      await this.insertAuditEvents(client, created.auditEvents);
      await client.query("COMMIT");
      return { ...created, replayed: false, recovered: false };
    } catch (error) {
      await client.query("ROLLBACK");

      if ((error as { code?: string }).code === "23505" && idempotencyKey) {
        const existing = await this.findCaseByIdempotencyKey(idempotencyKey);
        if (existing) {
          return { ...existing, replayed: true, recovered: false };
        }
      }

      throw error;
    } finally {
      client.release();
    }
  }

  private async recoverFailedCase(
    created: StoredCaseBundle
  ): Promise<{ caseRecord: CaseRecord; auditEvents: AuditEvent[]; replayed: boolean; recovered: boolean }> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      await this.updateCaseRow(client, created.caseRecord);
      await this.replaceTransactions(client, created.caseRecord.id, created.caseRecord.transactions);
      await this.insertAuditEvents(client, created.auditEvents.slice(2));
      const found = await this.findCaseWithClient(client, created.caseRecord.id);
      await client.query("COMMIT");

      if (!found) {
        throw new Error("case not found");
      }

      return { ...found, replayed: false, recovered: true };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async recordFailedRetry(
    created: StoredCaseBundle
  ): Promise<{ caseRecord: CaseRecord; auditEvents: AuditEvent[]; replayed: boolean; recovered: boolean }> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      await this.updateCaseRow(client, created.caseRecord);
      await this.insertAuditEvents(client, created.auditEvents.slice(2));
      const found = await this.findCaseWithClient(client, created.caseRecord.id);
      await client.query("COMMIT");

      if (!found) {
        throw new Error("case not found");
      }

      return { ...found, replayed: false, recovered: false };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async insertCaseRow(client: PoolClient, caseRecord: CaseRecord, idempotencyKey?: string): Promise<void> {
    await client.query(
      `INSERT INTO ${this.schema}.cases (
        id,
        wallet_address,
        status,
        risk_level,
        risk_score,
        risk_indicators,
        trace_id,
        created_at,
        reviewed_at,
        reviewer_note,
        idempotency_key,
        source_metadata
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::timestamptz, $9::timestamptz, $10, $11, $12::jsonb)`,
      [
        caseRecord.id,
        caseRecord.walletAddress,
        caseRecord.status,
        caseRecord.risk.level,
        caseRecord.risk.score,
        JSON.stringify(caseRecord.risk.indicators),
        caseRecord.traceId,
        caseRecord.createdAt,
        caseRecord.reviewedAt ?? null,
        caseRecord.reviewerNote ?? null,
        idempotencyKey ?? null,
        JSON.stringify(caseRecord.sourceMetadata ?? null)
      ]
    );
  }

  private async updateCaseRow(client: PoolClient, caseRecord: CaseRecord): Promise<void> {
    await client.query(
      `UPDATE ${this.schema}.cases
       SET wallet_address = $2,
           status = $3,
           risk_level = $4,
           risk_score = $5,
           risk_indicators = $6::jsonb,
           trace_id = $7,
           reviewed_at = $8::timestamptz,
           reviewer_note = $9,
           source_metadata = $10::jsonb
       WHERE id = $1`,
      [
        caseRecord.id,
        caseRecord.walletAddress,
        caseRecord.status,
        caseRecord.risk.level,
        caseRecord.risk.score,
        JSON.stringify(caseRecord.risk.indicators),
        caseRecord.traceId,
        caseRecord.reviewedAt ?? null,
        caseRecord.reviewerNote ?? null,
        JSON.stringify(caseRecord.sourceMetadata ?? null)
      ]
    );
  }

  private async replaceTransactions(
    client: PoolClient,
    caseId: string,
    transactions: TransactionSample[]
  ): Promise<void> {
    await client.query(`DELETE FROM ${this.schema}.transactions WHERE case_id = $1`, [caseId]);

    for (const [index, transaction] of transactions.entries()) {
      await client.query(
        `INSERT INTO ${this.schema}.transactions (
          case_id,
          tx_hash,
          direction,
          amount_eth,
          confirmations,
          counterparty,
          position
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          caseId,
          transaction.hash,
          transaction.direction,
          transaction.amountEth.toFixed(2),
          transaction.confirmations,
          transaction.counterparty,
          index
        ]
      );
    }
  }

  private async insertAuditEvents(client: PoolClient, auditEvents: AuditEvent[]): Promise<void> {
    for (const auditEvent of auditEvents) {
      await client.query(
        `INSERT INTO ${this.schema}.audit_events (
          id,
          case_id,
          event_type,
          trace_id,
          at,
          details
        ) VALUES ($1, $2, $3, $4, $5::timestamptz, $6::jsonb)`,
        [
          auditEvent.id,
          auditEvent.caseId,
          auditEvent.type,
          auditEvent.traceId,
          auditEvent.at,
          JSON.stringify(auditEvent.details)
        ]
      );
    }
  }
}

function mapCaseRow(caseRow: CaseRow, transactionRows: TransactionRow[]): CaseRecord {
  return {
    id: caseRow.id,
    walletAddress: caseRow.wallet_address,
    status: caseRow.status,
    risk: {
      level: caseRow.risk_level,
      score: caseRow.risk_score,
      indicators: caseRow.risk_indicators
    },
    transactions: transactionRows.map((row) => ({
      hash: row.tx_hash,
      direction: row.direction,
      amountEth: Number(row.amount_eth),
      confirmations: row.confirmations,
      counterparty: row.counterparty
    })),
    sourceMetadata: caseRow.source_metadata ?? undefined,
    traceId: caseRow.trace_id,
    createdAt: new Date(caseRow.created_at).toISOString(),
    reviewedAt: caseRow.reviewed_at ? new Date(caseRow.reviewed_at).toISOString() : undefined,
    reviewerNote: caseRow.reviewer_note ?? undefined
  };
}

function mapCaseSummaryRow(caseRow: CaseRow): CaseSummary {
  return {
    id: caseRow.id,
    walletAddress: caseRow.wallet_address,
    status: caseRow.status,
    risk: {
      level: caseRow.risk_level,
      score: caseRow.risk_score,
      indicators: caseRow.risk_indicators
    },
    sourceMetadata: caseRow.source_metadata ?? undefined,
    traceId: caseRow.trace_id,
    createdAt: new Date(caseRow.created_at).toISOString(),
    reviewedAt: caseRow.reviewed_at ? new Date(caseRow.reviewed_at).toISOString() : undefined
  };
}

function mapAuditEventRow(row: AuditEventRow): AuditEvent {
  return {
    id: row.id,
    caseId: row.case_id,
    type: row.event_type,
    traceId: row.trace_id,
    at: new Date(row.at).toISOString(),
    details: row.details
  };
}

function normalizeCaseListFilters(filters: Partial<CaseListFilters>): CaseListFilters {
  return {
    limit: Math.max(1, Math.min(filters.limit ?? 20, 100)),
    status: filters.status,
    riskLevel: filters.riskLevel,
    search: filters.search?.trim() || undefined
  };
}

function buildCaseListWhereClause(filters: CaseListFilters): {
  sql: string;
  values: string[];
} {
  const conditions: string[] = [];
  const values: string[] = [];

  if (filters.status) {
    values.push(filters.status);
    conditions.push(`status = $${values.length}`);
  }

  if (filters.riskLevel) {
    values.push(filters.riskLevel);
    conditions.push(`risk_level = $${values.length}`);
  }

  if (filters.search) {
    values.push(`%${filters.search.toLowerCase()}%`);
    conditions.push(`(LOWER(wallet_address) LIKE $${values.length} OR LOWER(trace_id) LIKE $${values.length})`);
  }

  if (!conditions.length) {
    return { sql: "", values };
  }

  return {
    sql: `WHERE ${conditions.join(" AND ")}`,
    values
  };
}

function mapCaseSummaryCountRow(row?: CaseSummaryCountRow): CaseQueueSummary {
  return {
    total: Number(row?.total ?? 0),
    pendingReviewCount: Number(row?.pending_review_count ?? 0),
    failedIngestionCount: Number(row?.failed_ingestion_count ?? 0),
    approvedCount: Number(row?.approved_count ?? 0),
    rejectedCount: Number(row?.rejected_count ?? 0),
    highRiskCount: Number(row?.high_risk_count ?? 0),
    mediumRiskCount: Number(row?.medium_risk_count ?? 0),
    lowRiskCount: Number(row?.low_risk_count ?? 0)
  };
}

function mapTransitionCountRow(row?: TransitionCountRow): CaseStatusTransitionCounts {
  return {
    enteredReviewCount: Number(row?.entered_review_count ?? 0),
    approvedCount: Number(row?.approved_count ?? 0),
    rejectedCount: Number(row?.rejected_count ?? 0),
    failedIngestionCount: Number(row?.failed_ingestion_count ?? 0)
  };
}

function mapReviewLatencyRow(row?: ReviewLatencyRow): ReviewLatencySummary {
  return {
    reviewedCount: Number(row?.reviewed_count ?? 0),
    averageHours: parseNullableNumber(row?.average_hours),
    maxHours: parseNullableNumber(row?.max_hours),
    oldestPendingHours: parseNullableNumber(row?.oldest_pending_hours)
  };
}

function buildTimelineFromCaseRows(rows: TimelineCaseRow[]): CaseTimelinePoint[] {
  const byDay = new Map<string, CaseTimelinePoint>();

  for (const row of rows) {
    const createdDay = toUtcDay(row.created_at);
    const createdPoint = byDay.get(createdDay) ?? createEmptyTimelinePoint(createdDay);
    createdPoint.createdCount += 1;
    if (row.status === "ingestion_failed") {
      createdPoint.failedIngestionCount += 1;
    }
    byDay.set(createdDay, createdPoint);

    if (!row.reviewed_at) {
      continue;
    }

    const reviewedDay = toUtcDay(row.reviewed_at);
    const reviewedPoint = byDay.get(reviewedDay) ?? createEmptyTimelinePoint(reviewedDay);
    reviewedPoint.reviewedCount += 1;
    if (row.status === "approved") {
      reviewedPoint.approvedCount += 1;
    }
    if (row.status === "rejected") {
      reviewedPoint.rejectedCount += 1;
    }
    byDay.set(reviewedDay, reviewedPoint);
  }

  return [...byDay.values()]
    .sort((left, right) => left.day.localeCompare(right.day))
    .slice(-7);
}

function parseNullableNumber(value: string | null | undefined): number | null {
  if (value == null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function createEmptyTimelinePoint(day: string): CaseTimelinePoint {
  return {
    day,
    createdCount: 0,
    reviewedCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    failedIngestionCount: 0
  };
}

function toUtcDay(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function normalizeProviderFetchError(error: unknown): ProviderFetchError {
  if (error instanceof ProviderFetchError) {
    return error;
  }

  if (error instanceof Error) {
    return new ProviderFetchError(error.message, { code: "http_error" });
  }

  return new ProviderFetchError("provider request failed", { code: "http_error" });
}

function buildFailureSourceMetadata(error: ProviderFetchError, fetchedAt: string): SourceMetadata {
  return {
    provider: error.provider,
    mode: "live",
    network: "ethereum-mainnet",
    fetchedAt,
    attemptCount: 1,
    timeoutMs: error.timeoutMs,
    transactionCount: 0,
    errorCode: error.code,
    retriable: error.retriable
  };
}
