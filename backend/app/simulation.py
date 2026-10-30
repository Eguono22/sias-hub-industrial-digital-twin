"""Synthetic process plus a separate nominal reference model; not a physics twin."""
import math
import random
from datetime import datetime, timezone

MACHINES = [
    {"id": "EXT-001", "name": "Single-screw extruder", "kind": "extruder"},
    {"id": "LAM-001", "name": "Laminating / coating line", "kind": "coater"},
]
CHANNELS = {
    "temperature": {"label": "Barrel temperature", "unit": "°C", "tolerance": 5.0},
    "pressure": {"label": "Melt pressure", "unit": "bar", "tolerance": 5.0},
    "speed": {"label": "Motor speed", "unit": "rpm", "tolerance": 5.0},
    "vibration": {"label": "Vibration", "unit": "mm/s", "tolerance": 15.0},
    "throughput": {"label": "Throughput", "unit": "kg/h", "tolerance": 5.0},
}
BASELINES = {"EXT-001": [185, 122, 850, 1.8, 64], "LAM-001": [132, 80, 382, 1.2, 72]}

def reference(machine_id, elapsed):
    # Predictions use only operating targets and elapsed time, never observations.
    return {key: base * (1 + .004 * math.sin(elapsed / 14 + i))
            for i, (key, base) in enumerate(zip(CHANNELS, BASELINES[machine_id]))}

def sample(machine_id, elapsed, rng=None):
    rng = rng or random
    expected = reference(machine_id, elapsed)
    # A separate synthetic plant response with noise and a different time constant.
    observed = {key: base * (1 + .006 * math.sin(elapsed / 11 + i) + rng.gauss(0, .002))
                for i, (key, base) in enumerate(zip(CHANNELS, BASELINES[machine_id]))}
    deviation = {key: abs(observed[key] - expected[key]) / expected[key] * 100 for key in CHANNELS}
    return {"machine_id": machine_id, "timestamp": datetime.now(timezone.utc).isoformat(),
            "synthetic": True, "expected": expected, "observed": observed,
            "deviation": deviation, "anomalies": [key for key in CHANNELS if deviation[key] > CHANNELS[key]["tolerance"]]}
