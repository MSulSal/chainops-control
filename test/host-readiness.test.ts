import assert from "node:assert/strict";
import test from "node:test";
import { collectHostReadinessSnapshot } from "../src/host-readiness.ts";

type ProbeResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
};

test("reports blocked host-readiness checks when Docker engine and Terraform are unavailable", async () => {
  const commands = new Map<string, ProbeResult>([
    [
      "docker --version",
      {
        ok: true,
        stdout: "Docker version 27.0.0, build deadbeef",
        stderr: ""
      }
    ],
    [
      "docker compose version --short",
      {
        ok: true,
        stdout: "2.29.1",
        stderr: ""
      }
    ],
    [
      "docker info --format {{.ServerVersion}}",
      {
        ok: false,
        stdout: "",
        stderr: "open //./pipe/docker_engine: The system cannot find the file specified."
      }
    ],
    [
      "terraform version -json",
      {
        ok: false,
        stdout: "",
        stderr: "'terraform' is not recognized as an internal or external command"
      }
    ]
  ]);

  const snapshot = await collectHostReadinessSnapshot({
    env: {},
    runner: (command, args) => {
      const key = `${command} ${args.join(" ")}`;
      const result = commands.get(key);
      assert.ok(result, `unexpected command probe: ${key}`);
      return result;
    }
  });

  assert.equal(snapshot.scope, "host_readiness");
  assert.equal(snapshot.overall.statusLabel, "Blocked");
  assert.equal(snapshot.providerSandbox.status, "blocked");
  assert.match(snapshot.overall.summary, /Docker engine, Terraform CLI/i);
  assert.equal(snapshot.checks.find((check) => check.key === "docker_cli")?.status, "ready");
  assert.equal(snapshot.checks.find((check) => check.key === "docker_engine")?.status, "blocked");
  assert.equal(snapshot.checks.find((check) => check.key === "terraform_cli")?.status, "blocked");
  assert.equal(snapshot.checks.find((check) => check.key === "provider_base_url")?.status, "warning");
});

test("reports ready host-readiness checks when host prerequisites are satisfied", async () => {
  const commands = new Map<string, ProbeResult>([
    [
      "docker --version",
      {
        ok: true,
        stdout: "Docker version 27.0.0, build deadbeef",
        stderr: ""
      }
    ],
    [
      "docker compose version --short",
      {
        ok: true,
        stdout: "2.29.1",
        stderr: ""
      }
    ],
    [
      "docker info --format {{.ServerVersion}}",
      {
        ok: true,
        stdout: "27.0.3",
        stderr: ""
      }
    ],
    [
      "terraform version -json",
      {
        ok: true,
        stdout: JSON.stringify({ terraform_version: "1.9.2" }),
        stderr: ""
      }
    ]
  ]);

  const snapshot = await collectHostReadinessSnapshot({
    env: {
      CHAINOPS_ETHERSCAN_BASE_URL: "https://api.etherscan.io/api",
      CHAINOPS_API_BASE_URL: "http://127.0.0.1:4317"
    },
    runner: (command, args) => {
      const key = `${command} ${args.join(" ")}`;
      const result = commands.get(key);
      assert.ok(result, `unexpected command probe: ${key}`);
      return result;
    }
  });

  assert.equal(snapshot.overall.statusLabel, "Ready");
  assert.equal(snapshot.providerSandbox.status, "ready");
  assert.equal(snapshot.providerSandbox.missingRequirements.length, 0);
  assert.equal(snapshot.checks.every((check) => check.status === "ready"), true);
  assert.match(snapshot.providerSandbox.nextSteps[0], /Terraform sandbox commands/i);
});
