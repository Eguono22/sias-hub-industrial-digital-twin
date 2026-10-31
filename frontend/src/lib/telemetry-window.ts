import type { Sample } from "./telemetry";

export function mergeTelemetry(
  previous: Sample[],
  incoming: Sample[],
  machine: string,
  source: "builtin" | "module1",
): Sample[] {
  const unique = new Map<number, Sample>();
  for (const sample of [...previous, ...incoming]) {
    if (sample.machine_id === machine && (sample.source ?? "builtin") === source) {
      unique.set(Date.parse(sample.timestamp), sample);
    }
  }
  return [...unique.entries()]
    .sort(([a], [b]) => a - b)
    .slice(-60)
    .map(([, sample]) => sample);
}
