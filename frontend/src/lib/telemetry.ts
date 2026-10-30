"use client";
import { useEffect, useRef, useState } from "react";
export const channels = [
  { key: "temperature", label: "Barrel temperature", unit: "°C", tolerance: 5 },
  { key: "pressure", label: "Melt pressure", unit: "bar", tolerance: 5 },
  { key: "speed", label: "Motor speed", unit: "rpm", tolerance: 5 },
  { key: "vibration", label: "Vibration", unit: "mm/s", tolerance: 15 },
  { key: "throughput", label: "Throughput", unit: "kg/h", tolerance: 5 },
] as const;
export type Channel = (typeof channels)[number]["key"];
export type Sample = {
  machine_id: string;
  timestamp: string;
  synthetic: boolean;
  source?: "builtin" | "module1";
  source_machine_id?: string;
  expected: Record<Channel, number | null>;
  observed: Record<Channel, number | null>;
  deviation: Record<Channel, number | null>;
  anomalies: Channel[];
};
export const machines = [
  { id: "EXT-001", name: "Single-screw extruder" },
  { id: "LAM-001", name: "Laminating / coating line" },
];
const base = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
).replace(/\/$/, "");
function isSample(value: unknown, machine: string): value is Sample {
  if (!value || typeof value !== "object") return false;
  const s = value as Sample;
  return (
    s.machine_id === machine &&
    typeof s.timestamp === "string" &&
    Number.isFinite(Date.parse(s.timestamp)) &&
    s.synthetic === true &&
    Array.isArray(s.anomalies) &&
    channels.every(
      (c) =>
        (s.observed?.[c.key] === null &&
          s.expected?.[c.key] === null &&
          s.deviation?.[c.key] === null) ||
        (Number.isFinite(s.observed?.[c.key]) &&
          Number.isFinite(s.expected?.[c.key]) &&
          Number.isFinite(s.deviation?.[c.key])),
    )
  );
}
export function useTelemetry(machine: string, paused: boolean) {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [status, setStatus] = useState("Connecting");
  const [storage, setStorage] = useState("Unknown");
  const previousMachine = useRef(machine);
  useEffect(() => {
    let disposed = false,
      socket: WebSocket | undefined,
      reconnect: ReturnType<typeof setTimeout> | undefined;
    const abort = new AbortController();
    let backoff = 1000;
    if (previousMachine.current !== machine) {
      setSamples([]);
      previousMachine.current = machine;
    }
    if (paused) {
      setStatus("Paused");
      return;
    }
    const merge = (incoming: Sample[]) =>
      setSamples((previous) => {
        const unique = new Map(
          [...previous, ...incoming].map((s) => [s.timestamp, s]),
        );
        return [...unique.values()]
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
          .slice(-60);
      });
    const connect = async () => {
      setStatus("Connecting");
      try {
        const [history, health] = await Promise.all([
          fetch(`${base}/api/machines/${machine}/history?limit=60`, {
            signal: abort.signal,
          }),
          fetch(`${base}/health`, { signal: abort.signal }),
        ]);
        if (!history.ok || !health.ok) throw Error("API unavailable");
        const data: unknown = await history.json(),
          info = await health.json();
        if (disposed) return;
        if (!Array.isArray(data) || !data.every((s) => isSample(s, machine)))
          throw Error("Invalid telemetry");
        merge(data);
        setStorage(info.storage);
        const url = new URL(`${base}/ws/machines/${machine}`);
        url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
        socket = new WebSocket(url);
        socket.onopen = () => {
          if (!disposed) {
            setStatus("Live");
            backoff = 1000;
          }
        };
        socket.onmessage = (e) => {
          try {
            const data: unknown = JSON.parse(e.data);
            if (!disposed && isSample(data, machine)) merge([data]);
          } catch {
            setStatus("Invalid stream data");
          }
        };
        socket.onclose = () => {
          if (!disposed) retry();
        };
        socket.onerror = () => socket?.close();
      } catch {
        if (!disposed) retry();
      }
    };
    const retry = () => {
      setStatus("Disconnected · retrying");
      reconnect = setTimeout(connect, backoff);
      backoff = Math.min(backoff * 2, 15000);
    };
    void connect();
    return () => {
      disposed = true;
      abort.abort();
      clearTimeout(reconnect);
      socket?.close();
    };
  }, [machine, paused]);
  return { samples, status, storage };
}
