-- Alternative initial migration for Neon's Apache-licensed TimescaleDB.
-- Set TELEMETRY_RETENTION_MODE=application on the API; do not run the
-- full-edition database/001_telemetry.sql against this database.
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE TABLE IF NOT EXISTS public.telemetry (
  time TIMESTAMPTZ NOT NULL,
  machine_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  PRIMARY KEY (machine_id, time)
);
SELECT create_hypertable('public.telemetry', 'time', if_not_exists => TRUE);
