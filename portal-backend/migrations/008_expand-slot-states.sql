-- Migration: expand-slot-states
-- Created: 2026-04-20
-- Adds lifecycle states (stopped, starting, stopping, configuring, resetting)
-- and last_error column for diagnostics surface.

-- Up Migration

ALTER TABLE lab_slots
  DROP CONSTRAINT lab_slots_status_check;

ALTER TABLE lab_slots
  ADD CONSTRAINT lab_slots_status_check
  CHECK (status IN (
    'empty',
    'deploying',
    'running',
    'stopped',
    'starting',
    'stopping',
    'configuring',
    'resetting',
    'error',
    'destroying'
  ));

ALTER TABLE lab_slots
  ADD COLUMN IF NOT EXISTS last_error TEXT;

---- Down Migration

ALTER TABLE lab_slots
  DROP COLUMN IF EXISTS last_error;

ALTER TABLE lab_slots
  DROP CONSTRAINT lab_slots_status_check;

ALTER TABLE lab_slots
  ADD CONSTRAINT lab_slots_status_check
  CHECK (status IN ('empty', 'deploying', 'running', 'error', 'destroying'));
