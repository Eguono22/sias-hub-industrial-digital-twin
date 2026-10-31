"""Opt-in persistence test; run against an isolated, migrated TimescaleDB."""
import asyncio
import os

import pytest
from app.simulation import sample
from app.storage import Store

def database_store(url):
    return Store(url, retention_mode=os.getenv('TEST_RETENTION_MODE', 'timescaledb'))

@pytest.mark.skipif(not os.getenv('TEST_DATABASE_URL'), reason='TEST_DATABASE_URL is not set')
def test_persistence_survives_store_restart():
    async def check():
        url = os.environ['TEST_DATABASE_URL']
        value = {**sample('EXT-001', 12), 'source': 'module1'}
        first = database_store(url)
        await first.open()
        try:
            await first.append(value)
        finally:
            await first.close()
        second = database_store(url)
        await second.open()
        try:
            history = await second.history('EXT-001', 1800, source='module1')
            assert value not in await second.history('EXT-001', 1800, source='builtin')
            assert value in history
            assert history == sorted(history, key=lambda row: row['timestamp'])
            async with second.pool.acquire() as conn:
                assert await conn.fetchval("SELECT count(*) FROM timescaledb_information.hypertables WHERE hypertable_name='telemetry'") == 1
                if second.retention_mode == 'timescaledb':
                    assert await conn.fetchval("SELECT count(*) FROM timescaledb_information.jobs WHERE proc_name='policy_retention'") >= 1
        finally:
            from datetime import datetime
            await second.pool.execute('DELETE FROM telemetry WHERE machine_id=$1 AND time=$2', value['machine_id'], datetime.fromisoformat(value['timestamp']))
            await second.close()
    asyncio.run(check())

@pytest.mark.skipif(not os.getenv('TEST_DATABASE_URL') or os.getenv('TEST_RETENTION_MODE') != 'application', reason='Requires isolated application-retention database')
def test_application_retention_drops_old_chunks_and_preserves_recent_data():
    from datetime import datetime, timedelta, timezone
    async def check():
        store = database_store(os.environ['TEST_DATABASE_URL'])
        await store.open()
        old = {**sample('EXT-001', 0), 'timestamp': (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()}
        recent = sample('EXT-001', 1)
        try:
            await store.append(old)
            await store.append(recent)
            assert old in await store.history('EXT-001', 1800)
            store.next_cleanup = 0
            await store.cleanup()
            history = await store.history('EXT-001', 1800)
            assert old not in history
            assert recent in history
        finally:
            await store.pool.execute('DELETE FROM telemetry WHERE machine_id=$1 AND time = ANY($2::timestamptz[])', 'EXT-001', [datetime.fromisoformat(v['timestamp']) for v in (old, recent)])
            await store.close()
    asyncio.run(check())
