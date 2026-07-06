import { spawnSync } from "node:child_process";

export type HostReadinessStatus = "ready" | "warning" | "blocked";

export type HostReadinessCheck = {
  key: string;
  label: string;
  status: HostReadinessStatus;
  summary: string;
  detail: string;
  command: string | null;
};

export type HostReadinessSnapshot = {
  generatedAt: string;
  scope: "host_readiness";
  overall: {
    statusLabel: "Ready" | "Watch" | "Blocked";
    summary: string;
  };
  runtime: {
    dockerComposeFile: string;
    terraformSandboxPath: string;
    reviewerWorkspacePath: string;
    apiBaseUrl: string;
  };
  checks: HostReadinessCheck[];
  providerSandbox: {
    status: HostReadinessStatus;
    summary: string;
    missingRequirements: string[];
    nextSteps: string[];
  };
  boundaries: string[];
};

type CommandRunner = (command: string, args: string[]) => {
  ok: boolean;
  stdout: string;
  stderr: string;
  error?: string;
};

export async function collectHostReadinessSnapshot(options: {
  runner?: CommandRunner;
  env?: Record<string, string | undefined>;
} = {}): Promise<HostReadinessSnapshot> {
  const runner = options.runner ?? runCommand;
  const env = options.env ?? process.env;

  const dockerCliProbe = runner("docker", ["--version"]);
  const dockerComposeProbe = dockerCliProbe.ok
    ? runner("docker", ["compose", "version", "--short"])
    : skippedProbe("Docker CLI is unavailable, so Compose could not be checked.");
  const dockerEngineProbe = dockerCliProbe.ok
    ? runner("docker", ["info", "--format", "{{.ServerVersion}}"])
    : skippedProbe("Docker CLI is unavailable, so engine connectivity could not be checked.");
  const terraformProbe = runner("terraform", ["version", "-json"]);

  const providerBaseUrl = env.CHAINOPS_ETHERSCAN_BASE_URL?.trim();
  const providerCheck = providerBaseUrl
    ? {
        status: "ready" as const,
        summary: "Live provider base URL configured",
        detail: `CHAINOPS_ETHERSCAN_BASE_URL points to ${providerBaseUrl}.`,
        command: null
      }
    : {
        status: "warning" as const,
        summary: "Live provider base URL not configured",
        detail:
          "The service will fall back to the deterministic fixture provider until CHAINOPS_ETHERSCAN_BASE_URL is set for a provider-backed runtime check.",
        command: "set CHAINOPS_ETHERSCAN_BASE_URL=https://api.etherscan.io/api"
      };

  const checks: HostReadinessCheck[] = [
    buildCommandCheck({
      key: "docker_cli",
      label: "Docker CLI",
      command: "docker --version",
      probe: dockerCliProbe,
      successSummary: trimCommandOutput(dockerCliProbe.stdout) || "Docker CLI is available.",
      failureSummary: "Docker CLI is unavailable on this host."
    }),
    buildCommandCheck({
      key: "docker_compose",
      label: "Docker Compose",
      command: "docker compose version --short",
      probe: dockerComposeProbe,
      successSummary: `Docker Compose ${trimCommandOutput(dockerComposeProbe.stdout)} is available.`,
      failureSummary: "Docker Compose is unavailable from the current Docker installation."
    }),
    buildCommandCheck({
      key: "docker_engine",
      label: "Docker engine",
      command: "docker info --format {{.ServerVersion}}",
      probe: dockerEngineProbe,
      successSummary: trimCommandOutput(dockerEngineProbe.stdout)
        ? `Docker engine ${trimCommandOutput(dockerEngineProbe.stdout)} is reachable.`
        : "Docker engine is reachable.",
      failureSummary: "Docker engine is not reachable from this host."
    }),
    buildCommandCheck({
      key: "terraform_cli",
      label: "Terraform CLI",
      command: "terraform version -json",
      probe: terraformProbe,
      successSummary: `Terraform is available (${readTerraformVersion(terraformProbe.stdout)}).`,
      failureSummary: "Terraform CLI is unavailable on this host."
    }),
    {
      key: "provider_base_url",
      label: "Live provider base URL",
      status: providerCheck.status,
      summary: providerCheck.summary,
      detail: providerCheck.detail,
      command: providerCheck.command
    }
  ];

  const missingRequirements = checks
    .filter((check) => check.status !== "ready")
    .map((check) => `${check.label}: ${check.summary}`);

  const providerSandboxStatus = checks.some((check) => check.status === "blocked")
    ? "blocked"
    : checks.some((check) => check.status === "warning")
      ? "warning"
      : "ready";

  return {
    generatedAt: new Date().toISOString(),
    scope: "host_readiness",
    overall: {
      statusLabel:
        providerSandboxStatus === "blocked" ? "Blocked" : providerSandboxStatus === "warning" ? "Watch" : "Ready",
      summary: getOverallSummary(providerSandboxStatus, checks)
    },
    runtime: {
      dockerComposeFile: "docker-compose.yml",
      terraformSandboxPath: "infra/terraform/sandbox",
      reviewerWorkspacePath: "/",
      apiBaseUrl: env.CHAINOPS_API_BASE_URL?.trim() || "http://127.0.0.1:4317"
    },
    checks,
    providerSandbox: {
      status: providerSandboxStatus,
      summary: getProviderSandboxSummary(providerSandboxStatus, missingRequirements),
      missingRequirements,
      nextSteps: getNextSteps(checks)
    },
    boundaries: [
      "This artifact reports the current host readiness for local Docker, Compose, Terraform, and provider-backed prerequisite checks only.",
      "A ready status here does not claim a managed deployment target, paid cloud resource, or successful terraform apply against a provider.",
      "When a prerequisite is missing, the deterministic fixture runtime and existing release evidence remain the truthful fallback path."
    ]
  };
}

function buildCommandCheck(input: {
  key: string;
  label: string;
  command: string;
  probe: ReturnType<CommandRunner>;
  successSummary: string;
  failureSummary: string;
}): HostReadinessCheck {
  return {
    key: input.key,
    label: input.label,
    status: input.probe.ok ? "ready" : "blocked",
    summary: input.probe.ok ? input.successSummary : input.failureSummary,
    detail: input.probe.ok
      ? trimCommandOutput(input.probe.stdout) || input.successSummary
      : trimCommandOutput(input.probe.stderr) ||
        trimCommandOutput(input.probe.error) ||
        "The command did not return a usable result.",
    command: input.command
  };
}

function getOverallSummary(status: HostReadinessStatus, checks: HostReadinessCheck[]): string {
  if (status === "ready") {
    return "Docker, Compose, Terraform, and the live provider base URL are all available for the next provider-backed sandbox check.";
  }

  if (status === "warning") {
    return "The local runtime is still usable, but at least one provider-backed prerequisite remains incomplete on this host.";
  }

  const blockedLabels = checks.filter((check) => check.status === "blocked").map((check) => check.label);
  return `Provider-backed sandbox validation is blocked on this host until ${blockedLabels.join(", ")} is fixed.`;
}

function getProviderSandboxSummary(
  status: HostReadinessStatus,
  missingRequirements: string[]
): string {
  if (status === "ready") {
    return "The host passes the current prerequisite checks for the first provider-backed sandbox attempt.";
  }

  if (status === "warning") {
    return `The host can keep exercising the deterministic runtime path, but provider-backed validation is still incomplete: ${missingRequirements.join("; ")}.`;
  }

  return `The first provider-backed sandbox attempt should stay paused on this host: ${missingRequirements.join("; ")}.`;
}

function getNextSteps(checks: HostReadinessCheck[]): string[] {
  const nextSteps: string[] = [];

  for (const check of checks) {
    if (check.status === "ready") {
      continue;
    }

    if (check.command) {
      nextSteps.push(`Resolve ${check.label} and rerun \`${check.command}\`.`);
    } else {
      nextSteps.push(`Resolve ${check.label} before retrying the provider-backed sandbox path.`);
    }
  }

  if (!nextSteps.length) {
    nextSteps.push("Run the Terraform sandbox commands from the runbook on the current host.");
  }

  return nextSteps;
}

function readTerraformVersion(stdout: string): string {
  try {
    const parsed = JSON.parse(stdout) as { terraform_version?: string };
    return parsed.terraform_version || "version reported";
  } catch {
    return trimCommandOutput(stdout) || "version reported";
  }
}

function skippedProbe(detail: string) {
  return {
    ok: false,
    stdout: "",
    stderr: detail
  };
}

function trimCommandOutput(value: string | undefined): string {
  return value?.trim() || "";
}

function runCommand(command: string, args: string[]) {
  try {
    const result = spawnSync(command, args, {
      encoding: "utf8",
      timeout: 2000,
      windowsHide: true
    });

    return {
      ok: result.status === 0,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      error: result.error?.message
    };
  } catch (error) {
    return {
      ok: false,
      stdout: "",
      stderr: "",
      error: (error as Error).message
    };
  }
}
