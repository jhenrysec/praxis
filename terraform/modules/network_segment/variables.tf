# terraform/modules/network_segment/variables.tf

variable "slot_number" {
  type        = number
  description = "Student slot number (1-20)"
  validation {
    condition     = var.slot_number >= 1 && var.slot_number <= 20
    error_message = "slot_number must be between 1 and 20"
  }
}
