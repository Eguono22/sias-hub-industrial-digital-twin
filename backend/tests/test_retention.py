import asyncio

import pytest
from app.storage import Store


def test_invalid_retention_mode_is_rejected():
    with pytest.raises(ValueError, match='TELEMETRY_RETENTION_MODE'):
        Store(retention_mode='automatic')


def test_application_cleanup_is_throttled_and_retries_failures(monkeypatch):
    async def check():
        clock = [100.0]
        monkeypatch.setattr('app.storage.time.monotonic', lambda: clock[0])
        class Pool:
            calls = 0
            fail = False
            async def execute(self, sql):
                self.calls += 1
                assert 'drop_chunks' in sql and '30 days' in sql
                if self.fail:
                    raise RuntimeError('Database unavailable')
        store = Store(retention_mode='application')
        pool = Pool()
        store.pool = pool
        await store.cleanup()
        assert pool.calls == 1
        await store.cleanup()
        assert pool.calls == 1
        clock[0] += 3600
        pool.fail = True
        with pytest.raises(RuntimeError):
            await store.cleanup()
        pool.fail = False
        await store.cleanup()
        assert pool.calls == 3
    asyncio.run(check())


def test_native_retention_does_not_schedule_application_cleanup():
    async def check():
        store = Store()
        store.pool = object()  # Any attempted SQL call would fail.
        await store.cleanup()
        assert store.next_cleanup == 0
    asyncio.run(check())
