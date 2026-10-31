const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");

// Compile the pure TypeScript helper using the project's existing compiler.
const filename = path.join(__dirname, "../src/lib/telemetry-window.ts");
const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const helper = { exports: {} };
new Function("exports", compiled)(helper.exports);
const { mergeTelemetry } = helper.exports;
const sample = (timestamp, source = "builtin", machine_id = "EXT-001") => ({
  timestamp, source, machine_id,
});

test("switching either source replaces the old window even with older new timestamps", () => {
  for (const [oldSource, newSource] of [["builtin", "module1"], ["module1", "builtin"]]) {
    const old = sample("2026-10-30T20:00:00Z", oldSource);
    const next = sample("2026-10-29T20:00:00Z", newSource);
    assert.deepEqual(mergeTelemetry([old], [next], "EXT-001", newSource), [next]);
  }
});

test("empty history for a different source clears the previous window", () => {
  assert.deepEqual(mergeTelemetry([sample("2026-10-30T20:00:00Z")], [], "EXT-001", "module1"), []);
});

test("same-source reconnection retains history and replaces duplicate instants", () => {
  const first = sample("2026-10-30T10:00:00-07:00");
  const replacement = sample("2026-10-30T17:00:00Z");
  const later = sample("2026-10-30T16:30:00-01:00");
  assert.deepEqual(mergeTelemetry([first], [later, replacement], "EXT-001", "builtin"), [replacement, later]);
});

test("machine and source isolation also apply to incoming samples", () => {
  const valid = sample("2026-10-30T17:00:00Z");
  const otherMachine = sample(valid.timestamp, "builtin", "LAM-001");
  const otherSource = sample(valid.timestamp, "module1");
  assert.deepEqual(mergeTelemetry([otherMachine], [otherSource, valid], "EXT-001", "builtin"), [valid]);
});

test("window keeps the most recent 60 samples and accepts legacy built-in samples", () => {
  const values = Array.from({ length: 65 }, (_, i) => sample(new Date(1793383200000 + i * 2000).toISOString()));
  delete values[64].source;
  const merged = mergeTelemetry(values.slice(0, 30), values.slice(30).reverse(), "EXT-001", "builtin");
  assert.deepEqual(merged, values.slice(-60));
});
