locals {
  api_base_url      = "http://${var.api_host}:${var.api_port}"
  reviewer_base_url = "http://${var.api_host}:${var.reviewer_port}"

  api_environment = merge(
    {
      PORT                  = tostring(var.api_port)
      CHAINOPS_DATABASE_URL = var.database_url
    },
    var.etherscan_base_url == null ? {} : {
      CHAINOPS_ETHERSCAN_BASE_URL = var.etherscan_base_url
    }
  )

  runtime_contract = {
    sandbox_name = var.sandbox_name
    compose = {
      project_name = var.compose_project_name
      services = {
        postgres = {
          image       = var.postgres_image
          healthcheck = "pg_isready -U chainops -d chainops"
        }
        api = {
          image       = var.api_image
          environment = local.api_environment
          health_url  = "${local.api_base_url}/health"
          ready_url   = "${local.api_base_url}/ready"
          demo_reset  = "${local.api_base_url}/demo/reset"
        }
      }
    }
    reviewer = {
      base_url     = local.reviewer_base_url
      api_base_url = local.api_base_url
    }
    smoke = {
      demo    = "npm run smoke:demo"
      runtime = "npm run smoke:runtime"
    }
    notes = {
      infrastructure_scope = "Validated runtime contract only. No provider-backed Docker or cloud resources are created by this slice."
      provider_mode        = var.etherscan_base_url == null ? "deterministic-fixture" : "etherscan-compatible"
    }
  }

  operator_runbook = concat(
    [
      "docker compose -p ${var.compose_project_name} up -d postgres",
      "docker compose -p ${var.compose_project_name} up -d api",
      "Invoke-WebRequest -UseBasicParsing ${local.runtime_contract.compose.services.api.health_url}",
      "Invoke-WebRequest -UseBasicParsing ${local.runtime_contract.compose.services.api.ready_url}"
    ],
    var.seed_demo_on_boot ? [
      "Invoke-RestMethod -Method Post -Uri ${local.runtime_contract.compose.services.api.demo_reset}"
    ] : [],
    [
      local.runtime_contract.smoke.runtime,
      "$env:CHAINOPS_API_BASE_URL = \"${local.api_base_url}\"",
      "npm run start:web"
    ]
  )
}

resource "terraform_data" "sandbox_contract" {
  input = local.runtime_contract

  lifecycle {
    precondition {
      condition     = var.api_port != var.reviewer_port
      error_message = "api_port and reviewer_port must differ so the API and reviewer workspace stay on separate listener ports."
    }

    precondition {
      condition     = var.api_port != 5432 && var.reviewer_port != 5432
      error_message = "API and reviewer ports must not reuse PostgreSQL's default port 5432."
    }
  }
}
