# Terraform Sandbox

This sandbox captures the current ChainOps Control runtime contract in Terraform without pretending the repository already provisions Docker or cloud infrastructure.

## Scope

- validate the current API, PostgreSQL, and reviewer workspace inputs
- emit the same health, readiness, seeded demo reset, and smoke commands that the runbook already uses
- preserve the reviewed sandbox manifest in Terraform state through `terraform_data`

It does not create provider-backed resources in this slice. That is intentional: the current product boundary is still local/container-first, Terraform is not available on every host that edits this repo, and there is no truthful managed-environment story yet.

## Use

```powershell
cd infra/terraform/sandbox
Copy-Item terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply -auto-approve
terraform output -json sandbox_manifest
terraform output operator_runbook
terraform destroy -auto-approve
```

## Inputs that matter

- `database_url`: must stay a PostgreSQL URL because the API runtime expects the same connection string contract used by `docker-compose.yml`.
- `api_port` and `reviewer_port`: must stay distinct and must not collide with PostgreSQL's default port.
- `etherscan_base_url`: optional; `null` keeps the deterministic fixture provider active for local demos and tests.

## Why this shape

The next provider-backed target should reuse this validated manifest instead of inventing a second deployment story. That keeps future Docker or cloud work anchored to the same API endpoints, smoke checks, and reviewer/runtime boundary already exercised by the repository today.
