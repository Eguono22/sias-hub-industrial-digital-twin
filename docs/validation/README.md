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
