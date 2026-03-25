# terraform/backend.tf
# Terraform state backend configuration
# Using local backend for single-node Proxmox lab
# Upgrade to remote backend (Consul, S3, or Terraform Cloud) if scaling to multi-node
#
# IMPORTANT: Never commit *.tfstate files to git (they contain sensitive data)
# The .gitignore already excludes *.tfstate and *.tfstate.backup

terraform {
  backend "local" {
    # State stored per-workspace in:
    # terraform/scenarios/<scenario_name>/terraform.tfstate
    # (gitignored)
  }
}
