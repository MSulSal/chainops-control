import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type RuntimeParityStatus = "passed" | "failed";
export type RuntimeParityEvidenceCaptureStatus = "captured" | "missing" | "unavailable";

export const RUNTIME_PARITY_ARTIFACT_FILES = [
  "runtime-parity-latest.json",
  "latest-release-record.json",
  "host-readiness.json",
  "focus-case-incident-snapshot.json",
  "ci-evidence-summary.json",
  "README.md"
] as const;

export const RUNTIME_PARITY_ARTIFACT_REVIEW_HINT =
  "Download the runtime-parity-evidence artifact from this GitHub Actions run to inspect the raw parity JSON, release record JSON, focus-case incident snapshot, host-readiness JSON, and capture summary without rerunning the live smoke path.";

export type RuntimeParityExportCheck = {
  path: string;
  status: "matched" | "missing" | "diverged" | "not_checked";
  detail: string;
};

export type RuntimeParityCiEvidence = {
  provider: "github_actions";
  artifactName: string;
  artifactFiles: string[];
  reviewHint: string;
  captures?: {
    runtimeParity: {
      status: Extract<RuntimeParityEvidenceCaptureStatus, "captured" | "missing">;
    };
    releaseRecord: {
      status: Extract<RuntimeParityEvidenceCaptureStatus, "captured" | "unavailable">;
    };
    hostReadiness: {
      status: Extract<RuntimeParityEvidenceCaptureStatus, "captured" | "unavailable">;
      statusLabel?: string;
    };
    focusCaseSnapshot: {
      status: Extract<RuntimeParityEvidenceCaptureStatus, "captured" | "unavailable" | "missing">;
      replayStatus?: RuntimeParityFocusCaseReplay["status"];
    };
  };
  run: {
    repository?: string;
    runId?: string;
    runAttempt?: string;
    refName?: string;
    sha?: string;
    serverUrl?: string;
    runUrl?: string;
  };
};

export type RuntimeParityFocusCaseReplay = {
  caseId: string;
  casePath: string;
  caseExportPath: string;
  traceId: string | null;
  status: "recovered" | "failed_again" | "not_attempted" | "not_applicable";
  replayAttempt: number | null;
  summary: string;
  history: Array<{
    attempt: number;
    status: "recovered" | "failed_again";
    at: string;
    traceId: string;
    summary: string;
  }>;
};

export type RuntimeParityResult = {
  checkedAt: string;
  baseUrl: string;
  status: RuntimeParityStatus;
  summary: string;
  comparedExports: string[];
  ignoredFields: string[];
  exportChecks: RuntimeParityExportCheck[];
  scenario?: string;
  failedCaseId?: string;
  traceIds?: string[];
  focusCaseReplay?: RuntimeParityFocusCaseReplay;
  error?: string;
  ciEvidence?: RuntimeParityCiEvidence;
};

const DEFAULT_RUNTIME_PARITY_PATH = path.join("data", "runtime-parity", "latest.json");

export async function readLatestRuntimeParityResult(
  filePath = getRuntimeParityArtifactPath()
): Promise<RuntimeParityResult | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as RuntimeParityResult;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function writeLatestRuntimeParityResult(
  result: RuntimeParityResult,
  filePath = getRuntimeParityArtifactPath()
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(result, null, 2));
}

export function getRuntimeParityArtifactPath(): string {
  return process.env.CHAINOPS_RUNTIME_PARITY_PATH?.trim() || DEFAULT_RUNTIME_PARITY_PATH;
}
