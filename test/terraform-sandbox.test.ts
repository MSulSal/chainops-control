import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const sandboxDir = path.join(repoRoot, "infra", "terraform", "sandbox");

function read(relativePath: string) {
  return readFileSync(path.join(sandboxDir, relativePath), "utf8");
}

test("terraform sandbox captures the current runtime boundary", () => {
  const main = read("main.tf");
  const outputs = read("outputs.tf");

  assert.match(main, /resource "terraform_data" "sandbox_contract"/);
  assert.match(main, /\/health/);
  assert.match(main, /\/ready/);
  assert.match(main, /\/demo\/reset/);
  assert.match(main, /npm run smoke:runtime/);
  assert.match(outputs, /output "sandbox_manifest"/);
  assert.match(outputs, /output "operator_runbook"/);
});

test("terraform sandbox validates critical inputs", () => {
  const variables = read("variables.tf");

  assert.match(variables, /variable "database_url"/);
  assert.match(variables, /postgres:\/\/ or postgresql:\/\//);
  assert.match(variables, /variable "etherscan_base_url"/);
  assert.match(variables, /http:\/\/ or https:\/\//);
  assert.match(variables, /variable "api_port"/);
  assert.match(variables, /variable "reviewer_port"/);
});

test("runbook and sandbox docs describe the bounded operator flow", () => {
  const sandboxReadme = read("README.md");
  const runbook = readFileSync(path.join(repoRoot, "RUNBOOK.md"), "utf8");

  assert.match(sandboxReadme, /terraform apply -auto-approve/);
  assert.match(sandboxReadme, /provider-backed resources/);
  assert.match(runbook, /## Terraform sandbox/);
  assert.match(runbook, /operator_runbook/);
  assert.match(runbook, /No provider-backed infrastructure is created in this slice/);
});
