import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager, suppress

import anyio

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from .simulation import CHANNELS, MACHINES, sample
from .storage import Store
from .module1 import Module1

logger = logging.getLogger(__name__)
origins = [x.strip() for x in os.getenv('CORS_ORIGINS', 'http://localhost:3000').split(',') if x.strip()]
store = Store(os.getenv('DATABASE_URL'))
subscribers = {m['id']: set() for m in MACHINES}
latest = {}
producer_error = None
source = None

async def produce():
    global producer_error
    started = time.monotonic()
    while True:
        try:
            elapsed = time.monotonic() - started
            values = await source.read(elapsed) if source else [sample(m['id'], elapsed) for m in MACHINES]
            for value in values:
                machine = {'id': value['machine_id']}
                value.setdefault('source', 'builtin')
                await store.append(value)
                latest[machine['id']] = value
                for queue in tuple(subscribers[machine['id']]):
                    if queue.full():
                        queue.get_nowait()
                    queue.put_nowait(value)
            producer_error = None
        except Exception:
            producer_error = 'Telemetry acquisition or persistence failed'
            logger.exception('Telemetry producer failed; retrying')
        await asyncio.sleep(2)

@asynccontextmanager
async def lifespan(app):
    global source, producer_error
    latest.clear()
    producer_error = None
    url = os.getenv('SIAS_SIMULATOR_URL')
    source = Module1(url, os.getenv('SIAS_SIMULATOR_SCENARIO', 'normal'), os.getenv('SIAS_SIMULATOR_TARGET', 'extruder-01')) if url else None
    await store.open()
    task = asyncio.create_task(produce())
    try:
        yield
    finally:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task
        if source:
            await source.close()
        await store.close()

app = FastAPI(title='SIAS Hub Digital Twin API', lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=['GET'], allow_headers=['*'])

def validate(machine_id):
    if machine_id not in subscribers:
        raise HTTPException(404, 'Unknown machine')

@app.get('/health')
async def health():
    if producer_error:
        raise HTTPException(503, producer_error)
    return {'status': 'ok', 'storage': 'timescaledb' if store.pool else 'memory', 'synthetic': True, 'source': 'module1' if source else 'builtin'}

@app.get('/api/machines')
async def machines():
    return {'machines': MACHINES, 'channels': CHANNELS, 'synthetic': True, 'source': 'module1' if source else 'builtin'}

@app.get('/api/machines/{machine_id}/telemetry')
async def telemetry(machine_id: str):
    validate(machine_id)
    if machine_id not in latest:
        raise HTTPException(503, 'Simulation warming up')
    return latest[machine_id]

@app.get('/api/machines/{machine_id}/history')
async def history(machine_id: str, limit: int = Query(60, ge=1, le=1800)):
    validate(machine_id)
    return await store.history(machine_id, limit, source='module1' if source else 'builtin')

@app.websocket('/ws/machines/{machine_id}')
async def stream(websocket: WebSocket, machine_id: str):
    if machine_id not in subscribers:
        await websocket.close(code=1008, reason='Unknown machine')
        return
    if websocket.headers.get('origin') not in origins:
        await websocket.close(code=1008, reason='Origin not allowed')
        return
    await websocket.accept()
    queue = asyncio.Queue(maxsize=1)
    subscribers[machine_id].add(queue)
    async def send():
        if machine_id in latest:
            await websocket.send_json(latest[machine_id])
        while True:
            await websocket.send_json(await queue.get())
    async def receive():
        while True:
            await websocket.receive_text()
    tasks = [asyncio.create_task(send()), asyncio.create_task(receive())]
    try:
        done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        for task in done:
            task.result()
    except (WebSocketDisconnect, RuntimeError, asyncio.CancelledError):
        pass
    finally:
        subscribers[machine_id].discard(queue)
        for task in tasks:
            task.cancel()
        with anyio.CancelScope(shield=True):
            await asyncio.gather(*tasks, return_exceptions=True)
