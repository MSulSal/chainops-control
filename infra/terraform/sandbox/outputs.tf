output "sandbox_manifest" {
  description = "Disposable runtime contract captured in Terraform state."
  value       = terraform_data.sandbox_contract.output
}

output "operator_runbook" {
  description = "Commands for standing up and exercising the disposable runtime contract manually."
  value       = local.operator_runbook
}

output "health_endpoints" {
  description = "Health and readiness endpoints for the disposable API runtime."
  value = {
    health = local.runtime_contract.compose.services.api.health_url
    ready  = local.runtime_contract.compose.services.api.ready_url
  }
}
