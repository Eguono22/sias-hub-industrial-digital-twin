# Deployment handoff

Deploy the Next.js frontend on Vercel and the FastAPI service on Render, backed by a Timescale-enabled PostgreSQL database. Current provisioning and validation results are recorded in the [validation notes](validation/README.md).

## Validate the release

The `Validate` GitHub Actions workflow runs on pull requests, pushes to `main`, and manual dispatch. Its frontend job runs regression tests, a production build, and TypeScript checks on Node.js 24. Backend jobs use Python 3.12 and test native retention and application retention in separate isolated TimescaleDB services. The application job enables the Apache license to match Neon. Each migration runs twice to check repeatability, followed by the backend suite with persistence enabled. The workflow does not deploy anything. Configure branch protection and hosting deployment gates separately if checks must block releases.

The workflow's database password is a disposable CI fixture, not a production credential. Its build-time API URL is deliberately non-routable; hosted frontend builds need their actual API origin.

## Configure hosting

| Location | Setting | Value |
| --- | --- | --- |
| Database | Extension | TimescaleDB; migration role must be able to create it |
| Render | Blueprint | Repository-root `render.yaml` |
| Render | `DATABASE_URL` | TimescaleDB connection string with provider-required SSL options |
| Render | `CORS_ORIGINS` | Exact frontend origins, comma-separated, without paths or trailing slashes |
| Render | Instances / workers | One API instance; one Uvicorn worker |
| Render, optional | `SIAS_SIMULATOR_URL` | Reachable Module 1 service origin; omit for built-in simulation |
| Render, optional | `SIAS_SIMULATOR_SCENARIO` / `SIAS_SIMULATOR_TARGET` | Defaults: `normal` / `extruder-01` |
| Vercel | Root Directory | `frontend` |
| Vercel | Framework | Next.js |
| Vercel | Node.js | 24.x, matching CI |
| Vercel | Build command | `npm run build` |
| Vercel | `NEXT_PUBLIC_API_URL` | Render HTTPS origin, without a path |

First provision the database and apply the migration from the repository root:

For full-edition TimescaleDB (Tiger Cloud or the local Docker image):

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/001_telemetry.sql
```

For Neon provisioned through Vercel Marketplace, use the alternative migration:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/neon/001_telemetry.sql
```

Set `TELEMETRY_RETENTION_MODE=application` on the Render API when using Neon. The API drops chunks wholly older than 30 days at startup and then at most hourly during writes, using Apache-licensed `drop_chunks` instead of the full-edition retention scheduler. Cleanup resumes after API downtime; partially overlapping chunks remain until their newest data is old enough. Cleanup failures fail startup or make acquisition unhealthy, rather than silently disabling retention. The database role must own the hypertable or have permission to drop its chunks. Native TimescaleDB keeps the default `TELEMETRY_RETENTION_MODE=timescaledb` and its database retention job. Apply only the migration for the selected provider on a fresh database; these are alternative initial migrations, not an edition-conversion procedure.

In Vercel, choose Storage / Marketplace → Neon, or use the authenticated CLI with an existing integration:

```sh
vercel integration add neon --name sias-digital-twin --plan free_v3 \
  --metadata region=iad1 --metadata auth=false --no-connect --no-env-pull
vercel integration resource connect sias-digital-twin sias-hub-industrial-digital-twin \
  --environment production --yes
```

Create a dedicated Vercel project for this repository before connecting the resource. Do not reuse the unrelated `frontend` project. Keep connection strings server-side; copy Neon's direct SSL connection URL to Render's `DATABASE_URL`, retaining the provider's SSL settings. Never expose it with a `NEXT_PUBLIC_` prefix. Vercel's database environment variables do not automatically propagate to Render.

Provider compatibility references: [Neon's TimescaleDB feature limits](https://neon.com/docs/extensions/timescaledb) and [Vercel integration CLI](https://vercel.com/docs/cli/integration). Verify plan availability and limits before creating resources. The continuously running two-second producer consumes database compute and storage even without dashboard viewers.

Create the Render Blueprint and supply the database URL and frontend origin. The optional Module 1 variables are configured manually in the Render service environment; they are not required by the Blueprint. A local `localhost:8001` simulator cannot serve the hosted API. Leave the URL unset until a hosted source is reachable.

Import the frontend into Vercel, set its public API URL for each intended environment, and deploy. Add the final Vercel or custom-domain origin to Render's `CORS_ORIGINS` and redeploy the API after an origin change. Preview deployments need their exact origin allowed too; wildcard origins are not accepted by the current WebSocket validator. Changing `NEXT_PUBLIC_API_URL` requires a new frontend build.

## Verify the hosted release

Set `API_ORIGIN` and `FRONTEND_ORIGIN` in your shell to the real HTTPS origins, then check:

```sh
curl --fail-with-body "$API_ORIGIN/health"
curl --fail-with-body "$API_ORIGIN/api/machines/EXT-001/telemetry"
curl --fail-with-body "$API_ORIGIN/api/machines/LAM-001/history?limit=2"
curl --fail-with-body -D - -o /dev/null -H "Origin: $FRONTEND_ORIGIN" "$API_ORIGIN/api/machines"
```

Health should return `status: ok`, `storage: timescaledb`, and the intended source. The final response must include `access-control-allow-origin` equal to the frontend origin. A 503 can indicate startup acquisition, an unreachable upstream source, stale acquisition, or persistence failure; inspect API logs rather than switching silently to memory storage.

Open `/digital-twin` on the hosted frontend and confirm LIVE, database storage, both machines, pause/resume, charts, and CSV export. Browser developer tools should show a successful WSS connection and advancing timestamps. Repeat the relevant [validation checks](validation/README.md) on the hosted origins; local results do not establish hosted connectivity.

## Operations and rollback

Health is an acquisition-readiness check, so it intentionally fails when an upstream source or persistence fails. Run only one producer instance until shared coordination is implemented. The API currently has no authentication; restrict the deployment to the intended synthetic research demo audience.

Record the deployed commit, hosting URLs, and source mode with each release. To roll back, select the prior frontend/API deployments in the hosting dashboards, retaining compatible environment settings and the database volume. The current migration creates the telemetry table and retention policy; do not delete stored telemetry as a rollback step. Hosted rollback and database-server restart recovery have not been validated here.

Provider references: [Render Blueprint environment variables](https://render.com/docs/blueprint-spec#environment-variables), [Vercel project configuration](https://vercel.com/docs/project-configuration), and [GitHub Actions PostgreSQL services](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers).
