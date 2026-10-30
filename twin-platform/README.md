# SIAS Hub digital twin dashboard

Buildless HTML/CSS/JavaScript research prototype. Serve `dist` using any static HTTP server, for example `python3 -m http.server 8000 --directory dist` from this directory.

Includes selectable extrusion and laminating/coating schematics, component inspection, synthetic sensor telemetry refreshing every two seconds, pause/resume, rolling expected/observed charts, and CSV export.

All readings are synthetic. The reference model is a deterministic illustrative baseline, not an independently validated physics model. Machine health indicators are demonstration values, not predictive maintenance assessments. The machine illustrations are interactive SVG schematics rather than CAD or real 3D models. No hardware or Module 1 backend is connected.

Google Fonts is optional; system fonts work offline. No installation or build step is required.
