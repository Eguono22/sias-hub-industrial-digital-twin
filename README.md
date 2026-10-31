# SIAS Hub · Industrial Digital Twin

Research platform for extrusion and laminating/coating machines. The main SIAS Hub route is **`/digital-twin`**.

| Layer | Implementation |
| --- | --- |
| Frontend | Next.js App Router + TypeScript + React |
| 3D | Three.js + React Three Fiber + Drei |
| Charts | Recharts |
| Backend | Python + FastAPI |
| Integration | REST history + live WebSockets |
| Storage | PostgreSQL + TimescaleDB hypertable, 30-day retention |
| Deployment | Vercel frontend + Render API |

`frontend/` and `backend/` are the active application. `twin-platform/` preserves the earlier standalone Sites prototype and its separate source repository. It is not the Next.js application and is not updated by this migration.

## Run locally

Node.js 20.9+ and Python 3.9+ are required; Python 3.12 is configured on Render.

```sh
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements-dev.txt
cd backend
.venv/bin/uvicorn app.main:app --reload --port 8000
```

In a second terminal:

```sh
cd frontend
cp .env.example .env.local
npm ci
npm run dev
```

Open `http://localhost:3000/digital-twin`; `/` redirects there. FastAPI's interactive API documentation is at `http://localhost:8000/docs`.

Without `DATABASE_URL`, the API explicitly reports **memory** storage and retains at most 1,800 samples per machine. This is volatile development storage; it does not silently replace a failed configured database. The frontend shows unavailable/reconnecting states if the API is down.

## PostgreSQL + TimescaleDB

```sh
export POSTGRES_PASSWORD='choose-a-local-password'
docker compose up -d db
export DATABASE_URL="postgresql://sias:${POSTGRES_PASSWORD}@localhost:5432/sias_twin"
```

Restart the API in the same shell with `DATABASE_URL` exported. Use URL encoding if your password contains special URL characters. The compose database runs `database/001_telemetry.sql` on the first initialization of its persistent volume. For an existing or hosted database, apply the migration explicitly:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/001_telemetry.sql
```

The database provider must support the TimescaleDB extension and permit extension creation. Use a Timescale-enabled PostgreSQL service (for example Tiger Cloud) for production; a generic PostgreSQL service alone is not enough. Database startup/schema failures prevent API startup. Persistence failures make `/health` return 503.

## API and simulation

- `GET /health`: acquisition readiness, storage mode, and source. Returns 503 until both machines have persisted samples, during acquisition/persistence failure, or after ten seconds without a successful acquisition for either machine.
- `GET /api/machines`: machine and channel metadata.
- `GET /api/machines/{id}/telemetry`: latest sample.
- `GET /api/machines/{id}/history?limit=60`: oldest-to-newest history, maximum 1,800.
- `WS /ws/machines/{id}`: latest sample then updates every two seconds.

The latest-sample REST endpoint also returns 503 during acquisition/persistence failure or when its machine has no fresh acquisition. History remains readable during these outages. Freshness uses the API's monotonic acquisition clock, independent of upstream simulation timestamps; the dashboard separately checks sample timestamps. A successful collection cycle restores readiness automatically.

Machine IDs are `EXT-001` and `LAM-001`. Samples contain UTC timestamps, expected/observed values, percentage deviations, anomaly channels, and `synthetic: true`. A single producer runs independent of viewers, persists both machines, and fans out samples to subscribers. Slow viewers receive the newest sample instead of accumulating an unbounded queue.

The frontend retrieves REST history, connects to WebSockets, deduplicates timestamps, limits its rolling window to 60 samples, and reconnects with exponential backoff. Pause stops the current viewer's subscription; the shared backend simulation continues. Resume retrieves history and reconnects. CSV exports the displayed window. Select components in 3D or with the accessible dropdown; drag to orbit and scroll to zoom.

The simulation is implemented in `backend/app/simulation.py`, with storage and transport separate. Set `SIAS_SIMULATOR_URL` to enable the Module 1 REST adapter described below. The reference model uses nominal operating targets without consuming observations; neither the synthetic plant nor the reference is a validated physical model. Equipment geometry is procedural 3D, not manufacturer CAD. Condition bars show actual deviations relative to channel tolerances; they do not predict failures or remaining useful life.

The browser window is also separated by machine and telemetry source. Switching sources replaces previous readings even when the new history is empty. Timestamp ordering and deduplication compare instants, including equivalent timestamps with different UTC offsets.

## Deploy: Vercel + Render

See the [deployment handoff](docs/deployment.md) for CI checks, environment settings, hosted smoke checks, and rollback steps.

1. Provision a Timescale-enabled PostgreSQL database and apply `database/001_telemetry.sql`.
2. Create a Render Blueprint from `render.yaml`. Set `DATABASE_URL` to that database's connection string (including SSL settings required by its provider) and `CORS_ORIGINS` to the exact frontend origins, comma-separated without trailing slashes.
3. Import this repository into Vercel and set its **Root Directory** to `frontend`. Set `NEXT_PUBLIC_API_URL` to the Render HTTPS origin, then build/deploy. This public variable is embedded at build time; redeploy after changing it.
4. Ensure Render's `CORS_ORIGINS` includes the final Vercel/custom-domain origin. Visit `https://YOUR_FRONTEND/digital-twin` and check the live status and database storage label.

The browser connects directly to Render via REST and WSS; there is no Vercel WebSocket server. Run one Render API instance with one Uvicorn worker: the synthetic producer and subscriber fan-out are process-local. Multiple replicas require an external producer and shared broker. CORS and WebSocket origin validation are configured, but authentication is not implemented: deploy this synthetic research API only for its intended demo audience until SIAS identity is integrated. No Vercel/Render deployments or paid resources are created by these configuration files.

## Checks

```sh
cd frontend
npm run typecheck
npm test
npm run build
```

```sh
cd backend
.venv/bin/python -m pytest
```

API tests cover shared REST/WebSocket data, disconnect cleanup, unknown machines, CORS/origin checks, history limits and simulation/reference separation. An actual TimescaleDB instance is required to validate the SQL migration and persistent storage path.

For the opt-in database integration test after applying the migration:

```sh
cd backend
TEST_DATABASE_URL="$DATABASE_URL" .venv/bin/python -m pytest
```

Implementation references: [Next.js App Router](https://nextjs.org/docs/app), [React Three Fiber installation and React compatibility](https://r3f.docs.pmnd.rs/getting-started/installation), [FastAPI WebSocket testing](https://fastapi.tiangolo.com/advanced/testing-websockets/), [TimescaleDB hypertables](https://www.tigerdata.com/docs/reference/timescaledb/hypertables/create_hypertable), and [Render Blueprint specification](https://render.com/docs/blueprint-spec).

## Current local workspace

The dashboard uses `http://localhost:3012/digital-twin` and the API uses `http://localhost:8012`. Local credentials are stored in ignored `.env` files. To restart this configured workspace:

```sh
docker compose up -d --wait db
```

Then run these in separate terminals:

```sh
cd backend
.venv/bin/uvicorn app.main:app --env-file .env --host 127.0.0.1 --port 8012
```

```sh
cd frontend
npm run dev -- --hostname 127.0.0.1 --port 3012
```

`frontend/.env.local` points to the API on port 8012. The Compose volume retains telemetry when the API or database container restarts. `docker compose down` keeps the volume; adding `--volumes` deletes stored telemetry.

Browser validation results and desktop/mobile screenshots: [docs/validation/README.md](docs/validation/README.md).

## Module 1 simulator integration

The API can consume the SIAS Hub Industrial Machine Simulator over REST and broadcast its readings through the existing digital twin WebSocket endpoints. The current local workspace uses `SIAS_SIMULATOR_URL=http://localhost:8001` in `backend/.env`.

To enable the adapter elsewhere, set `SIAS_SIMULATOR_URL` to the simulator origin and restart the API. Leave it unset to use the built-in generator. Optional `SIAS_SIMULATOR_SCENARIO` (default `normal`) and `SIAS_SIMULATOR_TARGET` (default `extruder-01`) select the upstream fault scenario and its target. Supported scenario names come from the simulator's `/fault-scenarios` endpoint. The adapter reads `/machines` for nominal baselines and polls `/fleet/telemetry` for one frame per collection cycle; slow requests extend the nominal two-second interval. Elapsed simulation time restarts when the twin API restarts.

| Digital twin | Module 1 machine |
| --- | --- |
| EXT-001 | extruder-01 |
| LAM-001 | coating-01 |

Temperature (°C), pressure (bar), speed (rpm), and vibration (mm/s) retain their upstream units. Module 1 has no mass-throughput measurement in kg/h: throughput is `null`, displays as unavailable, and its chart has an explicit empty state. Flow in L/min is preserved in `raw_sensors` without converting it to kg/h. Original source machine IDs, scenario, timestamp and raw readings are retained in persisted samples.

Expected values in Module 1 mode are the machine catalog's nominal baselines, independent of observed readings. They are an illustrative reference, not a calibrated physical twin. Samples remain marked synthetic. `/health` and samples identify `builtin` or `module1`; the dashboard and CSV show the source. History queries separate the two sources, so switching modes does not combine built-in readings with upstream telemetry. Scenario history within the same source remains chronological and is not isolated by scenario.

If Module 1 fails, the producer retries and `/health` reports 503; the API does not fabricate substitute readings. Existing browser readings become stale. Restarting the API after removing `SIAS_SIMULATOR_URL` explicitly restores built-in mode.
