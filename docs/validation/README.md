# Browser validation · October 29, 2026

Tested `/digital-twin` with local Next.js and FastAPI services backed by TimescaleDB, using headless Chromium with software WebGL rendering. Desktop viewport: 1440 × 1100. Mobile viewport: 390 × 844.

| Check | Result |
| --- | --- |
| Live telemetry and database storage indicator | Passed |
| Three.js equipment rendered in a canvas | Passed; desktop and mobile screenshots inspected |
| Pause freezes readings without clearing them | Passed over multiple simulation updates |
| Resume restores telemetry updates | Passed |
| Extruder/coater switching and updated machine ID | Passed |
| Component selection using dropdown | Passed |
| Selecting a component by clicking the 3D model | Passed; clicked frame updated component selection |
| Recharts metric selection | Passed |
| CSV export | Passed; exported coater data excluded extruder samples |
| Mobile horizontal overflow | None at 390px |
| Camera orbit and zoom | Passed; rendered canvas changed after each control interaction |
| WebSocket reconnection | Passed; a closed connection was replaced and LIVE status restored |
| Browser JavaScript and resource errors after icon fix | None |
| TypeScript check | Passed |

Screenshots: [Desktop](desktop.png), [Mobile](mobile.png).

The initial browser run reported a missing tab icon. Added `frontend/src/app/icon.svg` using Next.js file-based icon metadata. Software-renderer GPU readback performance warnings occurred during screenshot capture; these do not establish hardware GPU performance.

This validation uses synthetic telemetry and procedural geometry. It does not validate physical accuracy, predictive maintenance performance, real sensor integration, Safari/Firefox compatibility, or physical mobile device rendering.

## Module 1 follow-up

Connected the local SIAS simulator on port 8001 to the digital twin API on port 8012. Live WebSocket samples retained upstream values and original units; `/health` confirmed `module1` with `timescaledb` storage. All 14 backend tests passed, including malformed/missing upstream data, upstream failure without fallback, and persistent source-separated history.

Chromium verified the Module 1 source label, four available channels, unavailable throughput, the throughput chart's empty state, coater switching and its comparison chart. No browser runtime errors occurred. [Module 1 screenshot](module1.png).

## API readiness follow-up · October 30, 2026

Added readiness checks for initial startup, incomplete fleet acquisition, acquisition/persistence errors, and acquisition older than ten seconds. Health and latest telemetry return 503 in these states; stored history remains accessible. A successful producer cycle restores readiness. Acquisition age uses a monotonic clock so upstream simulation timestamps do not determine API readiness.

Backend verification: 18 tests passed; the opt-in TimescaleDB integration test was skipped because `TEST_DATABASE_URL` was not supplied. This follow-up did not repeat browser validation.

## Browser follow-up · October 30, 2026

Validated with installed headless Chrome against temporary local Next.js and FastAPI services using built-in telemetry and memory storage. TypeScript and all 18 backend tests passed again; the database integration test remained skipped.

| Check | Result |
| --- | --- |
| Dashboard connects and displays LIVE | Passed |
| 3D canvas present | Passed; visual rendering was not inspected in this run |
| Pause and resume status transitions | Passed |
| Switch to LAM-001 and restore LIVE status | Passed |
| Mobile horizontal overflow at 390 × 844 | None |
| Captured JavaScript runtime exceptions | None |

Desktop viewport was 1440 × 1100. Temporary services were stopped after validation. This run did not validate Module 1, persistent storage, outage recovery in the browser, or physical mobile devices.

## Frontend source isolation · October 30, 2026

The displayed telemetry window now filters by machine and source on every merge. Source changes discard the previous source even when the new REST history is empty; history and health source mismatches trigger a connection retry. Same-source reconnections retain the rolling window. Timestamp comparison uses parsed instants to order UTC offsets correctly and deduplicate equivalent timestamps.

Five frontend regression tests passed with `npm test`: switching in both directions with older incoming timestamps, empty new-source history, equivalent timestamps and ordering, machine/source isolation, and the 60-sample window with legacy built-in samples. `npm run typecheck` and the production `npm run build` passed. Browser validation was not repeated for this change.

## Acquisition outage recovery · October 30, 2026

Ran installed headless Chrome against isolated Next.js and FastAPI services with memory storage and a controlled mock of the Module 1 REST interface. The mock supplied current UTC timestamps, nominal machine baselines, and four sensor channels. After the dashboard reached LIVE, the mock returned HTTP 503 for upstream requests while the API and WebSocket connection remained running.

| Check | Result |
| --- | --- |
| Initial Module 1 source label and LIVE status | Passed |
| Health and latest telemetry during acquisition failure | Both returned 503 |
| History access during outage | Returned 200; samples remained unchanged |
| Displayed sensor readings during outage | Retained without fabricated updates |
| Dashboard after sample freshness expired | Stream stale and OFFLINE |
| Restored acquisition without browser reload | Health returned 200; latest timestamp advanced; dashboard returned to LIVE |
| Captured JavaScript runtime exceptions | None |

Temporary services and Chrome were stopped after validation. This checks acquisition failure and recovery through the real adapter, producer, REST API, WebSocket, and dashboard. It does not validate the real Module 1 service, a dropped WebSocket connection, database failure or persistence, or source switching.

## TimescaleDB integration · October 30, 2026

Started Docker Desktop and created an isolated temporary container from the locally cached `timescale/timescaledb:latest-pg17` image, with an ephemeral database and a randomly assigned loopback port. Applied `database/001_telemetry.sql` successfully, creating the TimescaleDB extension, telemetry hypertable, and 30-day retention policy.

Ran the full backend suite with `TEST_DATABASE_URL` pointing to this temporary database: **19 tests passed, none skipped**. The integration test verified that a persisted Module 1 sample survived closing and reopening the storage connection, remained excluded from built-in source history, and appeared in chronological history. It also verified hypertable registration and retention-job presence.

Removed the temporary container and its data after validation; existing telemetry databases were not modified. Docker Desktop remains running. This verifies persistence across storage reconnects, not a database-server restart, retention-policy execution, or database-outage recovery.

## Browser source switching · October 30, 2026

Used installed headless Chrome with isolated Next.js and FastAPI services and memory storage. Module 1 readings came from a controlled mock REST interface. Kept the same browser page open while restarting the API in the sequence Module 1 → built-in → Module 1. A page token confirmed that no page reload occurred; each restart was observed to leave LIVE before reconnecting in the new mode.

| Check | Result |
| --- | --- |
| Automatic reconnection and correct source label in both directions | Passed |
| CSV source isolation | Every exported row belonged to the active source and EXT-001 |
| Chart window replacement | Three initial Module 1 samples became one built-in sample, then one Module 1 sample; chart and export counts matched |
| CSV throughput availability | Numeric built-in throughput; empty expected/observed values for Module 1 |
| Module 1 throughput comparison chart | Displayed “Channel not provided by source” |
| Captured JavaScript runtime exceptions | None |

Inspected the generated CSV Blob directly in the browser without downloading a file. Temporary services and Chrome were stopped afterward. This run does not validate the real Module 1 service, persistent history across mode changes, or an empty-history source transition in the browser; empty-history replacement is covered by the frontend regression tests.
