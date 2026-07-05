import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getRuntimeParityArtifactPath, type RuntimeParityResult } from "./runtime-parity.ts";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type RuntimeParityEvidenceSummary = {
  generatedAt: string;
  artifactName: string;
  baseUrl: string;
  runtimeParity: {
    status: "captured" | "missing";
    artifactPath: string;
    checkedAt?: string;
    result?: RuntimeParityResult;
  };
  releaseRecord: {
    status: "captured" | "unavailable";
    artifactPath?: string;
    version?: string;
    channel?: string;
    error?: string;
  };
  githubRun: {
    repository?: string;
    runId?: string;
    runAttempt?: string;
    refName?: string;
    sha?: string;
    serverUrl?: string;
    runUrl?: string;
  };
  notes: string[];
};

export type CaptureRuntimeParityEvidenceOptions = {
  artifactName?: string;
  outputDir?: string;
  baseUrl?: string;
  runtimeParityPath?: string;
  fetcher?: FetchLike;
  now?: Date;
  env?: NodeJS.ProcessEnv;
};

export async function captureRuntimeParityEvidence(
  options: CaptureRuntimeParityEvidenceOptions = {}
): Promise<RuntimeParityEvidenceSummary> {
  const artifactName = options.artifactName ?? "runtime-parity-evidence";
  const outputDir = options.outputDir ?? path.join("artifacts", "runtime-parity");
  const baseUrl = (options.baseUrl ?? process.env.CHAINOPS_SMOKE_BASE_URL?.trim() ?? "http://127.0.0.1:4317").replace(
    /\/$/,
    ""
  );
  const runtimeParityPath = options.runtimeParityPath ?? getRuntimeParityArtifactPath();
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? new Date();
  const env = options.env ?? process.env;

  await mkdir(outputDir, { recursive: true });

  const notes = [
    "Download this GitHub Actions artifact to review the latest runtime-parity result without rerunning the live smoke path."
  ];
  const summary: RuntimeParityEvidenceSummary = {
    generatedAt: now.toISOString(),
    artifactName,
    baseUrl,
    runtimeParity: {
      status: "missing",
      artifactPath: path.join(outputDir, "runtime-parity-latest.json")
    },
    releaseRecord: {
      status: "unavailable"
    },
    githubRun: buildGitHubRunMetadata(env, artifactName),
    notes
  };

  try {
    const runtimeParity = JSON.parse(await readFile(runtimeParityPath, "utf8")) as RuntimeParityResult;
    await writeFile(summary.runtimeParity.artifactPath, JSON.stringify(runtimeParity, null, 2));
    summary.runtimeParity = {
      status: "captured",
      artifactPath: summary.runtimeParity.artifactPath,
      checkedAt: runtimeParity.checkedAt,
      result: runtimeParity
    };
  } catch (error) {
    const errorCode = (error as NodeJS.ErrnoException).code;
    if (errorCode !== "ENOENT") {
      throw error;
    }

    notes.push("The runtime smoke step did not leave a persisted runtime-parity artifact on disk.");
  }

  const releaseRecordPath = path.join(outputDir, "latest-release-record.json");
  summary.releaseRecord.artifactPath = releaseRecordPath;

  try {
    const response = await fetcher(`${baseUrl}/exports/releases/latest`, {
      headers: { accept: "application/json" }
    });
    if (!response.ok) {
      throw new Error(`release record request failed: ${response.status} ${response.statusText}`);
    }

    const releaseRecord = (await response.json()) as {
      release?: { version?: string; channel?: string };
    };
    await writeFile(releaseRecordPath, JSON.stringify(releaseRecord, null, 2));
    summary.releaseRecord = {
      status: "captured",
      artifactPath: releaseRecordPath,
      version: releaseRecord.release?.version,
      channel: releaseRecord.release?.channel
    };
  } catch (error) {
    summary.releaseRecord = {
      status: "unavailable",
      artifactPath: releaseRecordPath,
      error: (error as Error).message
    };
    notes.push("The live release-record export was not reachable during capture; inspect the runtime-parity JSON for the last smoke result.");
  }

  await writeFile(path.join(outputDir, "ci-evidence-summary.json"), JSON.stringify(summary, null, 2));
  await writeFile(path.join(outputDir, "README.md"), buildRuntimeParityEvidenceReadme(summary));

  return summary;
}

export function buildRuntimeParityEvidenceReadme(summary: RuntimeParityEvidenceSummary): string {
  const lines = [
    "# Runtime Parity Evidence",
    "",
    `Generated at: ${summary.generatedAt}`,
    `Artifact name: ${summary.artifactName}`,
    `Checked base URL: ${summary.baseUrl}`,
    `Runtime parity artifact: ${summary.runtimeParity.status}`,
    `Release record capture: ${summary.releaseRecord.status}`
  ];

  if (summary.runtimeParity.result) {
    lines.push(`Runtime parity status: ${summary.runtimeParity.result.status}`);
    lines.push(`Runtime parity checked at: ${summary.runtimeParity.result.checkedAt}`);
  }

  if (summary.releaseRecord.version) {
    lines.push(`Release version: ${summary.releaseRecord.version}`);
  }

  if (summary.releaseRecord.channel) {
    lines.push(`Release channel: ${summary.releaseRecord.channel}`);
  }

  if (summary.githubRun.runUrl) {
    lines.push(`GitHub Actions run: ${summary.githubRun.runUrl}`);
  }

  lines.push("", "Notes:");
  for (const note of summary.notes) {
    lines.push(`- ${note}`);
  }

  return `${lines.join("\n")}\n`;
}

function buildGitHubRunMetadata(env: NodeJS.ProcessEnv, artifactName: string): RuntimeParityEvidenceSummary["githubRun"] {
  const repository = env.GITHUB_REPOSITORY?.trim();
  const runId = env.GITHUB_RUN_ID?.trim();
  const serverUrl = env.GITHUB_SERVER_URL?.trim();
  const runUrl = repository && runId && serverUrl ? `${serverUrl}/${repository}/actions/runs/${runId}` : undefined;

  return {
    repository,
    runId,
    runAttempt: env.GITHUB_RUN_ATTEMPT?.trim(),
    refName: env.GITHUB_REF_NAME?.trim(),
    sha: env.GITHUB_SHA?.trim(),
    serverUrl,
    runUrl
  };
}
