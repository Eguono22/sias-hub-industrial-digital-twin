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
