CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE TABLE IF NOT EXISTS telemetry (
  time TIMESTAMPTZ NOT NULL,
  machine_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  PRIMARY KEY (machine_id, time)
);
SELECT create_hypertable('telemetry', by_range('time'), if_not_exists => TRUE);
SELECT add_retention_policy('telemetry', INTERVAL '30 days', if_not_exists => TRUE);
