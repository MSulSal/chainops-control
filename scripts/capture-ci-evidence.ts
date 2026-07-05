import { appendFile, writeFile } from "node:fs/promises";
import { captureRuntimeParityEvidence } from "../src/ci-evidence.ts";

const artifactName = process.env.CHAINOPS_CI_ARTIFACT_NAME?.trim() || "runtime-parity-evidence";

async function main() {
  const summary = await captureRuntimeParityEvidence({ artifactName });
  console.log(
    `captured runtime parity evidence: parity=${summary.runtimeParity.status} release_record=${summary.releaseRecord.status}`
  );

  const stepSummaryPath = process.env.GITHUB_STEP_SUMMARY?.trim();
  if (stepSummaryPath) {
    const lines = [
      "## Runtime parity evidence",
      "",
      `- Artifact: \`${summary.artifactName}\``,
      `- Runtime parity artifact: \`${summary.runtimeParity.status}\``,
      `- Release record capture: \`${summary.releaseRecord.status}\``
    ];

    if (summary.runtimeParity.result) {
      lines.push(`- Runtime parity status: \`${summary.runtimeParity.result.status}\``);
      lines.push(`- Checked at: \`${summary.runtimeParity.result.checkedAt}\``);
    }

    if (summary.githubRun.runUrl) {
      lines.push(`- Run URL: ${summary.githubRun.runUrl}`);
    }

    if (summary.releaseRecord.error) {
      lines.push(`- Release record capture error: \`${summary.releaseRecord.error}\``);
    }

    lines.push("", "Review the uploaded artifact for the raw runtime-parity JSON, release record JSON, and capture summary.");
    await appendFile(stepSummaryPath, `${lines.join("\n")}\n`);
  } else {
    await writeFile("runtime-parity-step-summary.txt", JSON.stringify(summary, null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
