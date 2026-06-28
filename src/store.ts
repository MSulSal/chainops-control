import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  type ApprovalDecision,
  type AuditEvent,
  buildAuditEvent,
  type CaseRecord,
  createCaseRecord
} from "./domain.ts";

type StoreData = {
  cases: CaseRecord[];
  auditEvents: AuditEvent[];
};

const emptyStore: StoreData = {
  cases: [],
  auditEvents: []
};

export class JsonAuditStore {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async health(): Promise<{ ok: true; caseCount: number; auditEventCount: number }> {
    const data = await this.read();
    return { ok: true, caseCount: data.cases.length, auditEventCount: data.auditEvents.length };
  }

  async createCase(input: {
    walletAddress: string;
    traceId: string;
    now: string;
  }): Promise<{ caseRecord: CaseRecord; auditEvents: AuditEvent[] }> {
    const data = await this.read();
    const created = createCaseRecord(input);

    data.cases.push(created.caseRecord);
    data.auditEvents.push(...created.auditEvents);
    await this.write(data);

    return created;
  }

  async approveCase(input: {
    caseId: string;
    decision: ApprovalDecision;
    traceId: string;
    now: string;
    note?: string;
  }): Promise<{ caseRecord: CaseRecord; auditEvent: AuditEvent }> {
    const data = await this.read();
    const caseRecord = data.cases.find((candidate) => candidate.id === input.caseId);

    if (!caseRecord) {
      throw new Error("case not found");
    }

    if (caseRecord.status !== "pending_review") {
      throw new Error("case is no longer pending review");
    }

    caseRecord.status = input.decision === "approve" ? "approved" : "rejected";
    caseRecord.reviewedAt = input.now;
    caseRecord.reviewerNote = input.note;

    const auditEvent = buildAuditEvent(
      caseRecord.id,
      input.decision === "approve" ? "HUMAN_APPROVED" : "HUMAN_REJECTED",
      input.traceId,
      input.now,
      { note: input.note ?? null }
    );

    data.auditEvents.push(auditEvent);
    await this.write(data);

    return { caseRecord, auditEvent };
  }

  async findCase(caseId: string): Promise<{ caseRecord: CaseRecord; auditEvents: AuditEvent[] } | null> {
    const data = await this.read();
    const caseRecord = data.cases.find((candidate) => candidate.id === caseId);

    if (!caseRecord) {
      return null;
    }

    return {
      caseRecord,
      auditEvents: data.auditEvents.filter((event) => event.caseId === caseId)
    };
  }

  private async read(): Promise<StoreData> {
    try {
      const content = await readFile(this.filePath, "utf8");
      return JSON.parse(content) as StoreData;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return structuredClone(emptyStore);
      }

      throw error;
    }
  }

  private async write(data: StoreData): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  }
}
