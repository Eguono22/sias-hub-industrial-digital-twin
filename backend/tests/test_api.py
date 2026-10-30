import asyncio
import random

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
