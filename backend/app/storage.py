import json
from collections import deque
from datetime import datetime

class Store:
    def __init__(self, database_url=None):
        self.database_url = database_url
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
                        raise RuntimeError('Apply database/001_telemetry.sql before starting the API')
            except Exception:
                await self.pool.close()
                self.pool = None
                raise

    async def close(self):
        if self.pool:
            await self.pool.close()

    async def append(self, value):
        if self.pool:
            await self.pool.execute('INSERT INTO telemetry (time, machine_id, payload) VALUES ($1, $2, $3::jsonb)',
                                    datetime.fromisoformat(value['timestamp']), value['machine_id'], json.dumps(value))
        self.samples[value['machine_id']].append(value)

    async def history(self, machine_id, limit, source=None):
        if self.pool:
            rows = await self.pool.fetch('SELECT payload FROM telemetry WHERE machine_id=$1 AND ($3::text IS NULL OR COALESCE(payload->>\'source\', \'builtin\')=$3) ORDER BY time DESC LIMIT $2', machine_id, limit, source)
            return [json.loads(row['payload']) for row in reversed(rows)]
        return [row for row in self.samples[machine_id] if source is None or row.get('source', 'builtin') == source][-limit:]
