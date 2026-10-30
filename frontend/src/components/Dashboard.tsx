"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import {
  Activity,
  Box,
  ChartNoAxesCombined,
  ChevronRight,
  Download,
  HeartPulse,
  LayoutDashboard,
  Pause,
  Play,
  Radio,
  Settings2,
  Shapes,
} from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  channels,
  machines,
  useTelemetry,
  type Channel,
} from "@/lib/telemetry";
const MachineScene = dynamic(() => import("./MachineScene"), {
  ssr: false,
  loading: () => <div className="scene-fallback">Loading 3D equipment…</div>,
});
const parts = {
  "EXT-001": [
    "Drive motor",
    "Heated barrel",
    "Feed hopper",
    "Extrusion die",
    "Control cabinet",
  ],
  "LAM-001": ["Coating roller", "Roller stand", "Coating web"],
};
export default function Dashboard() {
  const [machine, setMachine] = useState<"EXT-001" | "LAM-001">("EXT-001"),
    [paused, setPaused] = useState(false),
    [metric, setMetric] = useState<Channel>("temperature"),
    [part, setPart] = useState("Heated barrel"),
    [section, setSection] = useState("Overview");
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(timer);
  }, []);
  const { samples, status, storage } = useTelemetry(machine, paused);
  const current = samples.at(-1),
    metadata = channels.find((c) => c.key === metric)!;
  const stale = !!current && now - Date.parse(current.timestamp) > 10000;
  const live = status === "Live" && !stale;
  const deviation = current?.deviation[metric];
  const monitored = current
    ? channels.filter((c) => current.observed[c.key] !== null).length
    : 0;
  const healthy = current && current.anomalies.length === 0;
  const chart = samples.map((s) => ({
    time: new Date(s.timestamp).toLocaleTimeString(),
    expected: s.expected[metric],
    observed: s.observed[metric],
  }));
  function exportCSV() {
    const rows = ["timestamp,machine,channel,expected,observed,unit,source"];
    samples.forEach((s) =>
      channels.forEach((c) =>
        rows.push(
          [
            s.timestamp,
            s.machine_id,
            c.key,
            s.expected[c.key],
            s.observed[c.key],
            c.unit,
            s.source ?? "builtin",
          ].join(","),
        ),
      ),
    );
    const url = URL.createObjectURL(
      new Blob([rows.join("\n")], { type: "text/csv" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `sias-${machine}-telemetry.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const nav = [
    ["Overview", LayoutDashboard, "overview"],
    ["Digital twins", Box, "machines"],
    ["Live telemetry", Activity, "telemetry"],
    ["Performance analysis", ChartNoAxesCombined, "performance"],
    ["Machine health", HeartPulse, "health"],
  ] as const;
  return (
    <div className="app">
      <aside>
        <a className="brand" href="/digital-twin">
          <span className="brand-icon">
            <Shapes size={25} />
          </span>
          <span>
            SIAS <b>HUB</b>
            <small>INDUSTRIAL INTELLIGENCE</small>
          </span>
        </a>
        <div className="nav-title">WORKSPACE</div>
        <nav>
          {nav.map(([label, Icon, id]) => (
            <button
              key={id}
              className={section === label ? "selected" : ""}
              onClick={() => {
                setSection(label);
                document
                  .getElementById(id)
                  ?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>
        <div className="nav-title">ENVIRONMENT</div>
        <div className="environment">
          <Radio size={15} /> Research sandbox
        </div>
        <div className="sidebar-bottom">
          <div className="engine">
            <span className={live ? "dot" : "dot amber"} />
            {live ? "Simulation stream online" : "Simulation stream offline"}
            <small>FastAPI · WebSocket telemetry</small>
          </div>
          <div className="profile">
            <span className="avatar">SR</span>
            <span>
              SIAS Researcher<small>Research workspace</small>
            </span>
          </div>
        </div>
      </aside>
      <main>
        <header>
          <span className="breadcrumb">
            Workspace <ChevronRight size={13} /> <b>Digital twin overview</b>
          </span>
          <div className="header-right">
            <span className={live ? "dot" : "dot amber"} />
            <span>{stale && !paused ? "Stream stale" : status}</span>
            <span className="avatar">SR</span>
          </div>
        </header>
        <div className="workspace" id="overview">
          <div className="heading">
            <div>
              <div className="eyebrow">INDUSTRIAL DIGITAL TWIN</div>
              <h1>Digital twin overview</h1>
              <p>
                A live window into your machines. Understand, compare, optimize.
              </p>
            </div>
            <div className="actions">
              <span className="badge">● SIMULATION MODE</span>
              <button onClick={() => setPaused(!paused)}>
                {paused ? <Play size={14} /> : <Pause size={14} />}{" "}
                {paused ? "Resume" : "Pause"}
              </button>
              <button
                className="primary"
                onClick={exportCSV}
                disabled={!samples.length}
              >
                <Download size={14} /> Export data
              </button>
            </div>
          </div>
          <div className="stats">
            <div className="stat">
              <div className="stat-label">
                DIGITAL TWINS <Box size={16} />
              </div>
              <strong>
                2 <small>machines</small>
              </strong>
              <p>
                <span className="dot" />
                Extrusion & coating
              </p>
            </div>
            <div className="stat">
              <div className="stat-label">
                SIMULATION STATUS <Radio size={16} />
              </div>
              <strong className="status-text">
                {paused ? "Paused" : live ? "Running" : "Offline"}{" "}
                <span className={live ? "dot" : "dot amber"} />
              </strong>
              <p>Shared simulation · 2s refresh</p>
            </div>
            <div className="stat">
              <div className="stat-label">
                MODEL AGREEMENT <Activity size={16} />
              </div>
              <strong>
                {deviation == null
                  ? "—"
                  : Math.max(0, 100 - deviation).toFixed(1)}{" "}
                <small>%</small>
              </strong>
              <p>Selected channel · current sample</p>
            </div>
            <div className="stat">
              <div className="stat-label">
                ACTIVE ANOMALIES <HeartPulse size={16} />
              </div>
              <strong>
                {current?.anomalies.length ?? "—"} <small>detected</small>
              </strong>
              <p>{monitored} sensor channels available</p>
            </div>
          </div>
          {!live && !paused && (
            <div className="connection" role="status">
              {status === "Connecting"
                ? "Connecting to the simulation service…"
                : "The simulation service is unavailable. Reconnecting automatically; any displayed samples are historical."}
            </div>
          )}
          <div className="dashboard-grid">
            <section className="panel machine-panel" id="machines">
              <div className="panel-head">
                <div>
                  <h2>Virtual machine</h2>
                  <p>Explore equipment and operating components</p>
                </div>
                <div className="tabs">
                  {machines.map((m) => (
                    <button
                      key={m.id}
                      className={machine === m.id ? "active" : ""}
                      onClick={() => {
                        setMachine(m.id as typeof machine);
                        setPart(
                          m.id === "EXT-001"
                            ? "Heated barrel"
                            : "Coating roller",
                        );
                      }}
                    >
                      {m.id === "EXT-001"
                        ? "Extrusion line"
                        : "Laminating / coating"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="scene">
                <div className="view-label">
                  TWIN / {machine}
                  <br />
                  INTERACTIVE 3D MODEL
                </div>
                <MachineScene
                  machine={machine}
                  running={live && !paused}
                  onSelect={setPart}
                />
                <div className="scene-hint">
                  Drag to orbit · Scroll to zoom · Click to inspect
                </div>
              </div>
              <div className="machine-footer">
                <span>{machines.find((m) => m.id === machine)?.name}</span>
                <select
                  aria-label="Machine component"
                  value={part}
                  onChange={(e) => setPart(e.target.value)}
                >
                  {parts[machine]
                    .concat(parts[machine].includes(part) ? [] : [part])
                    .map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                </select>
                <span className="badge">
                  {live ? "● Operating" : "○ Standby"}
                </span>
              </div>
            </section>
            <section className="panel" id="telemetry">
              <div className="panel-head">
                <div>
                  <h2>Live telemetry</h2>
                  <p>
                    {current?.source === "module1"
                      ? "Module 1 simulator"
                      : "Built-in simulation"}{" "}
                    · Synthetic stream
                  </p>
                </div>
                <span className={live ? "badge" : "badge muted"}>
                  {paused ? "Ⅱ PAUSED" : live ? "● LIVE" : "○ OFFLINE"}
                </span>
              </div>
              <div className="readings">
                {channels.map((c) => (
                  <div className="reading" key={c.key}>
                    <div>
                      <h3>{c.label}</h3>
                      <small>
                        <span className="dot" />
                        {!current
                          ? "Awaiting data"
                          : current.observed[c.key] === null
                            ? "Not provided by source"
                            : current.anomalies.includes(c.key)
                              ? "Outside tolerance"
                              : "Within tolerance"}
                      </small>
                    </div>
                    <div className="mini-chart">
                      <ResponsiveContainer width="100%" height={30}>
                        <LineChart
                          data={samples.map((s) => ({
                            value: s.observed[c.key],
                          }))}
                        >
                          <Line
                            dataKey="value"
                            stroke="#44b49c"
                            dot={false}
                            strokeWidth={1.5}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <strong>
                      {current
                        ? (current.observed[c.key]?.toFixed(
                            c.key === "speed" ? 0 : 1,
                          ) ?? "—")
                        : "—"}{" "}
                      <small>{c.unit}</small>
                    </strong>
                  </div>
                ))}
              </div>
              <div className="telemetry-footer">
                Last sample{" "}
                {current
                  ? new Date(current.timestamp).toLocaleTimeString()
                  : "—"}
                <span>{monitored} / 5 channels</span>
              </div>
            </section>
            <section className="panel" id="performance">
              <div className="panel-head">
                <div>
                  <h2>Expected vs. observed</h2>
                  <p>Nominal reference model · last {samples.length} samples</p>
                </div>
                <select
                  aria-label="Comparison metric"
                  value={metric}
                  onChange={(e) => setMetric(e.target.value as Channel)}
                >
                  {channels.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="chart-wrap">
                <div className="chart-legend">
                  <span>
                    <i />
                    Expected
                  </span>
                  <span>
                    <i className="observed" />
                    Observed
                  </span>
                  <span className="deviation">
                    Deviation: {deviation?.toFixed(2) ?? "—"}%
                  </span>
                </div>
                <div className="main-chart">
                  {samples.some((s) => s.observed[metric] !== null) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chart}
                        margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                      >
                        <CartesianGrid vertical={false} stroke="#edf0f5" />
                        <XAxis
                          dataKey="time"
                          tick={{ fontSize: 10, fill: "#91a0b1" }}
                          minTickGap={70}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          domain={["auto", "auto"]}
                          tick={{ fontSize: 10, fill: "#91a0b1" }}
                          tickFormatter={(v) =>
                            Number(v).toFixed(metric === "vibration" ? 2 : metric === "speed" ? 0 : 1)
                          }
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          formatter={(v) =>
                            `${Number(v).toFixed(2)} ${metadata.unit}`
                          }
                        />
                        <Line
                          dataKey="expected"
                          name="Expected"
                          stroke="#4977ed"
                          strokeDasharray="5 4"
                          dot={false}
                          strokeWidth={2}
                          isAnimationActive={false}
                        />
                        <Line
                          dataKey="observed"
                          name="Observed"
                          stroke="#42b59d"
                          dot={false}
                          strokeWidth={2}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-state">
                      <ChartNoAxesCombined size={28} />
                      <span>
                        {current && current.observed[metric] === null
                          ? "Channel not provided by source"
                          : "Waiting for simulation data"}
                      </span>
                      <small>
                        Expected and observed values will appear here.
                      </small>
                    </div>
                  )}
                </div>
              </div>
            </section>
            <section className="panel" id="health">
              <div className="panel-head">
                <div>
                  <h2>Machine condition</h2>
                  <p>Current deviations from nominal reference</p>
                </div>
                <span className="badge">
                  {!current
                    ? "No data"
                    : healthy
                      ? "Within tolerance"
                      : "Deviation"}
                </span>
              </div>
              <div className="health-body">
                {channels
                  .filter((c) =>
                    ["temperature", "vibration", "throughput"].includes(c.key),
                  )
                  .map((c) => {
                    const value = current?.deviation[c.key];
                    return (
                      <div key={c.key}>
                        <div className="health-row">
                          <span>{c.label}</span>
                          <span>
                            {value == null ? "Unavailable" : `${value.toFixed(2)}% / ${c.tolerance}%`}
                          </span>
                        </div>
                        <div className="bar">
                          <span
                            style={{
                              width: `${value == null ? 0 : Math.min(100, (value / c.tolerance) * 100)}%`,
                              background:
                                value != null && value > c.tolerance
                                  ? "#df9c49"
                                  : undefined,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                <div className="health-note">
                  <Settings2 size={15} />
                  <span>
                    Synthetic condition indicators only. Predictive maintenance
                    requires a validated model and real sensor data.
                  </span>
                </div>
              </div>
            </section>
          </div>
          <footer>
            <span>SIAS HUB / INDUSTRIAL INTELLIGENCE</span>
            <span>
              Storage: {storage} · Source:{" "}
              {current?.source === "module1" ? "Module 1" : "Built-in"} · All
              telemetry is synthetic
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}
