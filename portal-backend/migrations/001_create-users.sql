-- Migration: create-users
-- Created: 2026-03-31

-- Up Migration

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  username      VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(255) NOT NULL,
  student_id    VARCHAR(50),
  role          VARCHAR(20) NOT NULL DEFAULT 'student'
                  CHECK (role IN ('admin', 'instructor', 'student')),
  status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'active', 'locked', 'deleted')),
  lab_slot      SMALLINT UNIQUE CHECK (lab_slot BETWEEN 1 AND 20),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login    TIMESTAMPTZ,
  approved_by   UUID REFERENCES users(id),
  approved_at   TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_lab_slot ON users(lab_slot);

---- Down Migration

DROP TABLE IF EXISTS users;
DROP EXTENSION IF EXISTS "pgcrypto";
