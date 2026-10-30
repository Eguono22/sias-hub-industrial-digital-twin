"""Opt-in persistence test; run against an isolated, migrated TimescaleDB."""
import asyncio
import os

import pytest
from app.simulation import sample
from app.storage import Store

@pytest.mark.skipif(not os.getenv('TEST_DATABASE_URL'), reason='TEST_DATABASE_URL is not set')
def test_persistence_survives_store_restart():
    async def check():
        url = os.environ['TEST_DATABASE_URL']
        value = {**sample('EXT-001', 12), 'source': 'module1'}
        first = Store(url)
        await first.open()
        try:
            await first.append(value)
        finally:
            await first.close()
        second = Store(url)
        await second.open()
        try:
            history = await second.history('EXT-001', 1800, source='module1')
            assert value not in await second.history('EXT-001', 1800, source='builtin')
            assert value in history
            assert history == sorted(history, key=lambda row: row['timestamp'])
            async with second.pool.acquire() as conn:
                assert await conn.fetchval("SELECT count(*) FROM timescaledb_information.hypertables WHERE hypertable_name='telemetry'") == 1
                assert await conn.fetchval("SELECT count(*) FROM timescaledb_information.jobs WHERE proc_name='policy_retention'") >= 1
        finally:
            from datetime import datetime
            await second.pool.execute('DELETE FROM telemetry WHERE machine_id=$1 AND time=$2', value['machine_id'], datetime.fromisoformat(value['timestamp']))
            await second.close()
    asyncio.run(check())
