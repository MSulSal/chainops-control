import { Pool, type PoolClient } from "pg";
import {
  type ApprovalDecision,
  type AuditEvent,
  buildAuditEvent,
  type CaseRecord,
  createCaseRecord,
  type TransactionSample
} from "./domain.ts";

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

export type AuditStore = {
  init(): Promise<void>;
  close(): Promise<void>;
  health(): Promise<{ ok: true; caseCount: number; auditEventCount: number }>;
  createCase(input: {
    walletAddress: string;
    traceId: string;
    now: string;
    idempotencyKey?: string;
  }): Promise<{ caseRecord: CaseRecord; auditEvents: AuditEvent[]; replayed: boolean }>;
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

  constructor(databaseUrlOrOptions: string | { databaseUrl?: string; pool?: Pool; schema?: string }, schema = "public") {
    const databaseUrl =
      typeof databaseUrlOrOptions === "string" ? databaseUrlOrOptions : databaseUrlOrOptions.databaseUrl;
    const providedPool = typeof databaseUrlOrOptions === "string" ? undefined : databaseUrlOrOptions.pool;
    const resolvedSchema = typeof databaseUrlOrOptions === "string" ? schema : databaseUrlOrOptions.schema ?? "public";

    if (!databaseUrl && !providedPool) {
      throw new Error("databaseUrl or pool is required");
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(resolvedSchema)) {
      throw new Error("schema must contain only letters, numbers, and underscores");
    }

    this.pool = providedPool ?? new Pool({ connectionString: databaseUrl });
    this.schema = resolvedSchema;
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

  async createCase(input: {
    walletAddress: string;
    traceId: string;
    now: string;
    idempotencyKey?: string;
  }): Promise<{ caseRecord: CaseRecord; auditEvents: AuditEvent[]; replayed: boolean }> {
    await this.initPromise;
    const created = createCaseRecord(input);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      if (input.idempotencyKey) {
        const existingResult = await client.query<{ id: string }>(
          `SELECT id FROM ${this.schema}.cases WHERE idempotency_key = $1`,
          [input.idempotencyKey]
        );

        if (existingResult.rowCount) {
          const existing = await this.findCaseWithClient(client, existingResult.rows[0].id);
          await client.query("COMMIT");

          if (!existing) {
            throw new Error("idempotent case lookup failed");
          }

          return { ...existing, replayed: true };
        }
      }

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
          idempotency_key
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::timestamptz, $9::timestamptz, $10, $11)`,
        [
          created.caseRecord.id,
          created.caseRecord.walletAddress,
          created.caseRecord.status,
          created.caseRecord.risk.level,
          created.caseRecord.risk.score,
          JSON.stringify(created.caseRecord.risk.indicators),
          created.caseRecord.traceId,
          created.caseRecord.createdAt,
          created.caseRecord.reviewedAt ?? null,
          created.caseRecord.reviewerNote ?? null,
          input.idempotencyKey ?? null
        ]
      );

      for (const [index, transaction] of created.caseRecord.transactions.entries()) {
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
            created.caseRecord.id,
            transaction.hash,
            transaction.direction,
            transaction.amountEth.toFixed(2),
            transaction.confirmations,
            transaction.counterparty,
            index
          ]
        );
      }

      for (const auditEvent of created.auditEvents) {
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

      await client.query("COMMIT");
      return { ...created, replayed: false };
    } catch (error) {
      await client.query("ROLLBACK");

      if ((error as { code?: string }).code === "23505" && input.idempotencyKey) {
        const existingResult = await client.query<{ id: string }>(
          `SELECT id FROM ${this.schema}.cases WHERE idempotency_key = $1`,
          [input.idempotencyKey]
        );

        const existing = existingResult.rowCount
          ? await this.findCaseWithClient(client, existingResult.rows[0].id)
          : null;

        if (existing) {
          return { ...existing, replayed: true };
        }
      }

      throw error;
    } finally {
      client.release();
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
          status TEXT NOT NULL CHECK (status IN ('pending_review', 'approved', 'rejected')),
          risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
          risk_score INTEGER NOT NULL,
          risk_indicators JSONB NOT NULL,
          trace_id TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL,
          reviewed_at TIMESTAMPTZ,
          reviewer_note TEXT,
          idempotency_key TEXT UNIQUE
        )
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
    traceId: caseRow.trace_id,
    createdAt: new Date(caseRow.created_at).toISOString(),
    reviewedAt: caseRow.reviewed_at ? new Date(caseRow.reviewed_at).toISOString() : undefined,
    reviewerNote: caseRow.reviewer_note ?? undefined
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
