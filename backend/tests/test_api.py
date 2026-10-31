import asyncio
import random
import time

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from app import main
from app.simulation import CHANNELS, reference, sample
from app.storage import Store

@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(main, 'store', Store())
    with TestClient(main.app) as client:
        # Sync request gives the lifespan producer a chance to run.
        client.get('/health')
        yield client

def test_simulation_reference_and_deviation():
    value = sample('EXT-001', 10, random.Random(1))
    assert value['expected'] == reference('EXT-001', 10)
    assert value['synthetic'] is True
    assert set(value['observed']) == set(CHANNELS)
    for key in CHANNELS:
        assert value['observed'][key] > 0
        assert value['deviation'][key] == pytest.approx(abs(value['observed'][key]-value['expected'][key])/value['expected'][key]*100)
    assert sample('LAM-001', 10)['expected'] != value['expected']

def test_rest_history_and_validation(client):
    assert client.get('/health').json()['storage'] == 'memory'
    assert len(client.get('/api/machines').json()['machines']) == 2
    for machine in ('EXT-001', 'LAM-001'):
        latest = client.get(f'/api/machines/{machine}/telemetry').json()
        history = client.get(f'/api/machines/{machine}/history?limit=1').json()
        assert latest['machine_id'] == machine
        assert latest == history[-1]
    assert client.get('/api/machines/UNKNOWN/history').status_code == 404
    assert client.get('/api/machines/EXT-001/history?limit=0').status_code == 422
    assert client.get('/api/machines/EXT-001/history?limit=1801').status_code == 422

def test_websocket_shared_samples_and_cleanup(client):
    with client.websocket_connect('/ws/machines/EXT-001', headers={'origin':'http://localhost:3000'}) as ws:
        first = ws.receive_json()
        second = ws.receive_json()
        assert first['machine_id'] == second['machine_id'] == 'EXT-001'
        assert first['timestamp'] != second['timestamp']
        assert second == client.get('/api/machines/EXT-001/telemetry').json()
    assert not main.subscribers['EXT-001']

def test_websocket_rejects_untrusted_origin_and_unknown_machine(client):
    for path, origin in [('/ws/machines/EXT-001','https://untrusted.invalid'),('/ws/machines/UNKNOWN','http://localhost:3000')]:
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect(path, headers={'origin':origin}):
                pass

def test_cors(client):
    allowed=client.get('/api/machines',headers={'origin':'http://localhost:3000'})
    assert allowed.headers['access-control-allow-origin']=='http://localhost:3000'
    denied=client.get('/api/machines',headers={'origin':'https://untrusted.invalid'})
    assert 'access-control-allow-origin' not in denied.headers

def test_memory_history_is_bounded():
    async def check():
        store = Store()
        for i in range(1805):
            await store.append(sample('EXT-001', i))
        assert len(await store.history('EXT-001', 1800)) == 1800
        assert len(await store.history('EXT-001', 3)) == 3
    asyncio.run(check())

@pytest.mark.parametrize('state', ['warming', 'partial', 'stale', 'failed'])
def test_unready_api_preserves_history(monkeypatch, state):
    async def check():
        values = {m: sample(m, 0) for m in ('EXT-001', 'LAM-001')}
        store = Store()
        for value in values.values():
            await store.append(value)
        acquired = time.monotonic() - (11 if state == 'stale' else 0)
        monkeypatch.setattr(main, 'store', store)
        monkeypatch.setattr(main, 'source', None)
        monkeypatch.setattr(main, 'latest', {} if state == 'warming' else values)
        monkeypatch.setattr(main, 'last_acquired', {
            m: acquired for m in values if state != 'partial' or m == 'EXT-001'
        })
        monkeypatch.setattr(main, 'producer_error', 'Acquisition failed' if state == 'failed' else None)
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as error:
            await main.health()
        assert error.value.status_code == 503
        machine = 'LAM-001' if state == 'partial' else 'EXT-001'
        with pytest.raises(HTTPException) as error:
            await main.telemetry(machine)
        assert error.value.status_code == 503
        assert await main.history(machine, 60) == [values[machine]]
    asyncio.run(check())

def test_successful_acquisition_restores_readiness(monkeypatch):
    async def check():
        monkeypatch.setattr(main, 'store', Store())
        monkeypatch.setattr(main, 'source', None)
        monkeypatch.setattr(main, 'latest', {})
        monkeypatch.setattr(main, 'last_acquired', {})
        monkeypatch.setattr(main, 'producer_error', 'Previous failure')
        producer = asyncio.create_task(main.produce())
        try:
            await asyncio.sleep(0)
            assert (await main.health())['status'] == 'ok'
            for machine in ('EXT-001', 'LAM-001'):
                assert (await main.telemetry(machine))['machine_id'] == machine
                assert main.last_acquired[machine] <= time.monotonic()
        finally:
            producer.cancel()
            with pytest.raises(asyncio.CancelledError):
                await producer
    asyncio.run(check())
