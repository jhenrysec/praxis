-- Migration: create-objectives-progress
-- Created: 2026-03-31

-- Up Migration

CREATE TABLE objectives_progress (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot_number  SMALLINT NOT NULL REFERENCES lab_slots(slot_number),
  scenario_id  VARCHAR(100) NOT NULL,
  objective_n  SMALLINT NOT NULL,
  completed    BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  UNIQUE (user_id, slot_number, scenario_id, objective_n)
);

CREATE INDEX idx_objectives_user ON objectives_progress(user_id);
CREATE INDEX idx_objectives_slot ON objectives_progress(slot_number);

---- Down Migration

DROP TABLE IF EXISTS objectives_progress;
