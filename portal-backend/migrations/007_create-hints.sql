-- Migration: create-hints
-- Created: 2026-03-31

-- Up Migration

CREATE TABLE hints (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user   UUID NOT NULL REFERENCES users(id),
  to_slot     SMALLINT NOT NULL REFERENCES lab_slots(slot_number),
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at     TIMESTAMPTZ
);

CREATE INDEX idx_hints_slot ON hints(to_slot);
CREATE INDEX idx_hints_from ON hints(from_user);

---- Down Migration

DROP TABLE IF EXISTS hints;
