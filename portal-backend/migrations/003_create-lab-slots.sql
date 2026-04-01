-- Migration: create-lab-slots
-- Created: 2026-03-31

-- Up Migration

CREATE TABLE lab_slots (
  slot_number  SMALLINT PRIMARY KEY CHECK (slot_number BETWEEN 1 AND 20),
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  scenario_id  VARCHAR(100),
  status       VARCHAR(30) NOT NULL DEFAULT 'empty'
                 CHECK (status IN ('empty', 'deploying', 'running', 'error', 'destroying')),
  tf_workspace VARCHAR(100) UNIQUE,
  deployed_at  TIMESTAMPTZ,
  last_reset   TIMESTAMPTZ,
  deploy_log   TEXT
);

-- Pre-populate all 20 slots
INSERT INTO lab_slots (slot_number)
SELECT generate_series(1, 20);

---- Down Migration

DROP TABLE IF EXISTS lab_slots;
