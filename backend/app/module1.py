"""REST adapter for the SIAS Hub Industrial Machine Simulator (Module 1)."""
import math
from datetime import datetime

import httpx
from .simulation import CHANNELS

MAPPING = {'EXT-001': 'extruder-01', 'LAM-001': 'coating-01'}
FIELDS = {'temperature': 'temperature_c', 'pressure': 'pressure_bar',
          'speed': 'motor_speed_rpm', 'vibration': 'vibration_mm_s'}

class Module1:
    def __init__(self, url, scenario='normal', target='extruder-01', transport=None):
        self.client = httpx.AsyncClient(base_url=url.rstrip('/'), timeout=5, transport=transport)
        self.scenario, self.target = scenario, target
        self.baselines = None

    async def close(self):
        await self.client.aclose()

    async def read(self, elapsed):
        if self.baselines is None:
            response = await self.client.get('/machines')
            response.raise_for_status()
            catalog = {m['id']: m for m in response.json()['machines']}
            baselines = {}
            for twin, upstream in MAPPING.items():
                baseline = {key: float(catalog[upstream]['baseline'][field]) for key, field in FIELDS.items()}
                if not all(math.isfinite(v) and v > 0 for v in baseline.values()):
                    raise ValueError('Invalid Module 1 nominal baselines')
                baselines[twin] = baseline
            self.baselines = baselines
        response = await self.client.get('/fleet/telemetry', params={
            'target': self.target, 'scenario': self.scenario, 'start': max(0, int(elapsed)), 'count': 1})
        response.raise_for_status()
        frame = response.json()['samples'][-1]
        timestamp = frame['timestamp']
        parsed = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        if parsed.tzinfo is None:
            raise ValueError('Module 1 timestamp must include a timezone')
        readings = {r['machine_id']: r for r in frame['readings']}
        result = []
        for twin, upstream in MAPPING.items():
            raw = readings[upstream]
            observed = {key: float(raw[field]) for key, field in FIELDS.items()}
            if not all(math.isfinite(v) and v >= 0 for v in observed.values()):
                raise ValueError('Invalid Module 1 sensor readings')
            # A static nominal reference; predictions do not consume observations.
            expected = dict(self.baselines[twin])
            deviation = {key: abs(observed[key]-expected[key])/expected[key]*100 for key in FIELDS}
            anomalies = [key for key in FIELDS if deviation[key] > CHANNELS[key]['tolerance']]
            for values in (observed, expected, deviation):
                values['throughput'] = None  # Module 1 provides flow L/min, not mass throughput kg/h.
            result.append({'machine_id': twin, 'source_machine_id': upstream, 'source': 'module1',
                           'timestamp': parsed.isoformat(), 'synthetic': True,
                           'scenario': raw['scenario'], 'expected': expected, 'observed': observed,
                           'deviation': deviation, 'anomalies': anomalies, 'raw_sensors': raw})
        return result
