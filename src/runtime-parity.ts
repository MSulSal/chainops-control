import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type RuntimeParityStatus = "passed" | "failed";

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
