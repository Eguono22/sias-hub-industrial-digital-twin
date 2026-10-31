import json
import time
from collections import deque
from datetime import datetime

class Store:
    def __init__(self, database_url=None, retention_mode='timescaledb'):
        if retention_mode not in ('timescaledb', 'application'):
            raise ValueError('TELEMETRY_RETENTION_MODE must be timescaledb or application')
        self.database_url = database_url
        self.retention_mode = retention_mode
        self.next_cleanup = 0
        self.pool = None
        self.samples = {key: deque(maxlen=1800) for key in ("EXT-001", "LAM-001")}

    async def open(self):
        if self.database_url:
            import asyncpg
            self.pool = await asyncpg.create_pool(self.database_url, min_size=1, max_size=4)
            # Schema/extension provisioning is an explicit migration, not application DDL.
            try:
                async with self.pool.acquire() as conn:
                    if not await conn.fetchval("SELECT EXISTS (SELECT 1 FROM timescaledb_information.hypertables WHERE hypertable_schema='public' AND hypertable_name='telemetry')"):
                        migration = 'database/neon/001_telemetry.sql' if self.retention_mode == 'application' else 'database/001_telemetry.sql'
                        raise RuntimeError(f'Apply {migration} before starting the API')
                self.next_cleanup = 0
                await self.cleanup()
            except Exception:
                await self.pool.close()
                self.pool = None
                raise

    async def close(self):
        if self.pool:
            await self.pool.close()

    async def append(self, value):
        if self.pool:
            await self.cleanup()
            await self.pool.execute('INSERT INTO telemetry (time, machine_id, payload) VALUES ($1, $2, $3::jsonb)',
                                    datetime.fromisoformat(value['timestamp']), value['machine_id'], json.dumps(value))
        self.samples[value['machine_id']].append(value)

    async def cleanup(self):
        if self.pool and self.retention_mode == 'application' and time.monotonic() >= self.next_cleanup:
            # drop_chunks is available in the Apache edition; retention policies are not.
            await self.pool.execute("SELECT drop_chunks('public.telemetry', older_than => INTERVAL '30 days')")
            self.next_cleanup = time.monotonic() + 3600

    async def history(self, machine_id, limit, source=None):
        if self.pool:
            rows = await self.pool.fetch('SELECT payload FROM telemetry WHERE machine_id=$1 AND ($3::text IS NULL OR COALESCE(payload->>\'source\', \'builtin\')=$3) ORDER BY time DESC LIMIT $2', machine_id, limit, source)
            return [json.loads(row['payload']) for row in reversed(rows)]
        return [row for row in self.samples[machine_id] if source is None or row.get('source', 'builtin') == source][-limit:]
