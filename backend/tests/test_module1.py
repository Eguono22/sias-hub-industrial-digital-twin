import asyncio

import httpx
import pytest
from app.module1 import Module1
from app.simulation import sample
from app.storage import Store

BASE = {'temperature_c': 184.0, 'pressure_bar': 122.0, 'vibration_mm_s': 4.2, 'motor_speed_rpm': 845.0}

def payloads():
    catalog = {'machines': [{'id': key, 'baseline': dict(BASE)} for key in ('extruder-01', 'coating-01')]}
    frame = {'samples': [{'timestamp':'2026-10-29T22:00:00+00:00', 'readings': [
        {'machine_id':key, 'scenario':'bearing_wear', **BASE, 'vibration_mm_s':8.4, 'flow_l_min':180.0}
        for key in ('extruder-01', 'coating-01')]}]}
    return catalog, frame

def adapter(catalog, frame, status=200):
    def handler(request):
        if request.url.path == '/machines':
            return httpx.Response(200, json=catalog)
        assert request.url.path == '/fleet/telemetry'
        assert request.url.params['count'] == '1'
        return httpx.Response(status, json=frame)
    return Module1('http://module1.test', transport=httpx.MockTransport(handler))

def test_mapping_preserves_units_and_missing_throughput():
    async def check():
        source = adapter(*payloads())
        try:
            values = await source.read(12)
            assert [v['machine_id'] for v in values] == ['EXT-001','LAM-001']
            for value in values:
                assert value['observed']['speed'] == 845
                assert value['observed']['vibration'] == 8.4
                assert value['expected']['vibration'] == 4.2
                assert value['deviation']['vibration'] == 100
                assert 'vibration' in value['anomalies']
                assert value['source'] == 'module1' and value['synthetic']
                assert value['raw_sensors']['flow_l_min'] == 180
                for field in ('observed','expected','deviation'):
                    assert value[field]['throughput'] is None
        finally:
            await source.close()
    asyncio.run(check())

@pytest.mark.parametrize('fault',['missing_machine','missing_sensor','invalid_baseline','http_error'])
def test_bad_upstream_is_rejected_without_fabricated_samples(fault):
    async def check():
        catalog, frame = payloads()
        if fault == 'missing_machine': frame['samples'][0]['readings'].pop()
        if fault == 'missing_sensor': del frame['samples'][0]['readings'][0]['motor_speed_rpm']
        if fault == 'invalid_baseline': catalog['machines'][0]['baseline']['temperature_c'] = 0
        source = adapter(catalog, frame, 503 if fault == 'http_error' else 200)
        try:
            with pytest.raises((KeyError, ValueError, httpx.HTTPStatusError)):
                await source.read(1)
        finally:
            await source.close()
    asyncio.run(check())

def test_history_separates_sources():
    async def check():
        store = Store()
        builtin = sample('EXT-001',0)
        module1 = {**sample('EXT-001',1), 'source':'module1'}
        await store.append(builtin)
        await store.append(module1)
        assert await store.history('EXT-001',60,source='builtin') == [builtin]
        assert await store.history('EXT-001',60,source='module1') == [module1]
    asyncio.run(check())

def test_source_failure_reports_unhealthy_without_fallback(monkeypatch):
    from app import main
    from fastapi import HTTPException
    async def check():
        attempted = asyncio.Event()
        class Offline:
            async def read(self, elapsed):
                attempted.set()
                raise httpx.ConnectError('Module 1 unavailable')
        monkeypatch.setattr(main, 'source', Offline())
        monkeypatch.setattr(main, 'store', Store())
        monkeypatch.setattr(main, 'latest', {})
        monkeypatch.setattr(main, 'producer_error', None)
        producer = asyncio.create_task(main.produce())
        try:
            await asyncio.wait_for(attempted.wait(), 1)
            assert not main.latest
            assert await main.store.history('EXT-001', 60) == []
            with pytest.raises(HTTPException) as error:
                await main.health()
            assert error.value.status_code == 503
        finally:
            producer.cancel()
            try:
                await producer
            except asyncio.CancelledError:
                pass
    asyncio.run(check())
