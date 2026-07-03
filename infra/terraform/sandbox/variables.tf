variable "sandbox_name" {
  description = "Short identifier for the disposable runtime contract."
  type        = string
  default     = "chainops-local-sandbox"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.sandbox_name))
    error_message = "sandbox_name must use lowercase letters, numbers, or hyphens."
  }
}

variable "api_host" {
  description = "Host used when composing API and reviewer URLs."
  type        = string
  default     = "127.0.0.1"

  validation {
    condition     = length(trimspace(var.api_host)) > 0
    error_message = "api_host must be a non-empty hostname or IP address."
  }
}

variable "api_port" {
  description = "Exposed API port."
  type        = number
  default     = 4317

  validation {
    condition     = var.api_port >= 1 && var.api_port <= 65535
    error_message = "api_port must be between 1 and 65535."
  }
}

variable "reviewer_port" {
  description = "Exposed reviewer workspace port."
  type        = number
  default     = 3000

  validation {
    condition     = var.reviewer_port >= 1 && var.reviewer_port <= 65535
    error_message = "reviewer_port must be between 1 and 65535."
  }
}

variable "database_url" {
  description = "PostgreSQL connection string used by the API container."
  type        = string
  default     = "postgres://chainops:chainops@127.0.0.1:5432/chainops"

  validation {
    condition     = can(regex("^postgres(ql)?://", var.database_url))
    error_message = "database_url must start with postgres:// or postgresql://."
  }
}

variable "api_image" {
  description = "Container image or local tag used for the API runtime."
  type        = string
  default     = "chainops-control:local"

  validation {
    condition     = length(trimspace(var.api_image)) > 0
    error_message = "api_image must be a non-empty image reference."
  }
}

variable "postgres_image" {
  description = "Container image used for the disposable PostgreSQL runtime."
  type        = string
  default     = "postgres:16-alpine"

  validation {
    condition     = length(trimspace(var.postgres_image)) > 0
    error_message = "postgres_image must be a non-empty image reference."
  }
}

variable "etherscan_base_url" {
  description = "Optional live provider base URL. Leave null to use the deterministic fixture provider."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition     = var.etherscan_base_url == null || can(regex("^https?://", var.etherscan_base_url))
    error_message = "etherscan_base_url must be null or start with http:// or https://."
  }
}

variable "compose_project_name" {
  description = "Compose project name used in the operator commands."
  type        = string
  default     = "chainops-sandbox"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.compose_project_name))
    error_message = "compose_project_name must use lowercase letters, numbers, or hyphens."
  }
}

variable "seed_demo_on_boot" {
  description = "Whether the operator runbook should include a seeded demo reset after the API becomes ready."
  type        = bool
  default     = true
}
