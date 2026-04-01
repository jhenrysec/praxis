-- Migration: create-scenario-assignments
-- Created: 2026-03-31

-- Up Migration

CREATE TABLE scenario_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_number SMALLINT NOT NULL REFERENCES lab_slots(slot_number),
  scenario_id VARCHAR(100) NOT NULL,
  assigned_by UUID NOT NULL REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed   BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_assignments_slot ON scenario_assignments(slot_number);
CREATE INDEX idx_assignments_scenario ON scenario_assignments(scenario_id);

---- Down Migration

DROP TABLE IF EXISTS scenario_assignments;
