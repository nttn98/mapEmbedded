import React, { useMemo } from "react";
import "./style.css";
import mockData from "../../services/mockReportData";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as ReTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";

const fmt = (n) =>
  n == null ? "-" : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const DonutCenterLabel = ({ viewBox, total }) => {
  const { cx, cy } = viewBox;
  return (
    <>
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        style={{ fontWeight: 800, fontSize: 18, fill: "#0b1220" }}
      >
        {fmt(total)}
      </text>
      <text
        x={cx}
        y={cy + 16}
        textAnchor="middle"
        style={{ fontSize: 12, fill: "#6b7280" }}
      >
        Total
      </text>
    </>
  );
};

const Tooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      style={{
        background: "#111827",
        color: "#fff",
        padding: 8,
        borderRadius: 6,
        fontSize: 13,
      }}
    >
      {label && <div style={{ fontWeight: 800, marginBottom: 6 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div
            style={{
              width: 10,
              height: 10,
              background: p.color || p.payload.fill,
            }}
          />
          <div style={{ minWidth: 70 }}>{p.name || p.dataKey}</div>
          <div style={{ fontWeight: 800 }}>{fmt(p.value)}</div>
        </div>
      ))}
    </div>
  );
};

export default function ReportPage() {
  const {
    totalPlans,
    planStatuses,
    focusClassification,
    monthlyCommodities,
    familiesByMonth,
  } = mockData;

  const statusSegments = useMemo(
    () => [
      { name: "Cancel", value: planStatuses.Cancel, color: "#ef4444" },
      { name: "Draft", value: planStatuses.Draft, color: "#3b82f6" },
      { name: "Processing", value: planStatuses.Processing, color: "#06b6d4" },
      { name: "Expire", value: planStatuses.Expire, color: "#f59e0b" },
      { name: "Done", value: planStatuses.Done, color: "#16a34a" },
    ],
    [planStatuses]
  );

  const focusSegments = useMemo(
    () =>
      Object.keys(focusClassification).map((k, i) => ({
        name: k,
        value: focusClassification[k],
        color: ["#ef4444", "#3b82f6", "#06b6d4", "#f59e0b", "#16a34a"][i],
      })),
    [focusClassification]
  );

  const monthly = monthlyCommodities.map((m) => ({
    ...m,
    total: (m.llins || 0) + (m.repellent || 0) + (m.net || 0),
  }));

  return (
    <div className="report-root">
      <div className="rp-header">
        <div>
          <h1>Dashboard Reports</h1>
          <div className="rp-sub">Overview</div>
        </div>
        <div>
          <button className="btn ghost" onClick={() => window.history.back()}>
            ← Back
          </button>
        </div>
      </div>

      <div className="report-main">
        <aside className="left-kpi">
          <div className="kpi-inner">
            <div className="kpi-value big">{fmt(totalPlans)}</div>
            <div className="kpi-title">Plans Completed</div>
          </div>
        </aside>

        <div className="right-grid">
          <div className="card">
            <div className="card-head">
              <h4>Status</h4>
            </div>
            <div className="card-body split">
              <div className="chart-wrap" style={{ width: 200, height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusSegments}
                      dataKey="value"
                      innerRadius="58%"
                      outerRadius="92%"
                      paddingAngle={6}
                    >
                      {statusSegments.map((s, i) => (
                        <Cell key={i} fill={s.color} />
                      ))}
                    </Pie>
                    <DonutCenterLabel
                      viewBox={{ cx: 100, cy: 100 }}
                      total={statusSegments.reduce((s, x) => s + x.value, 0)}
                    />
                    <ReTooltip content={<Tooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="legend-compact">
                {statusSegments.map((s) => (
                  <li key={s.name}>
                    <span className="dot" style={{ background: s.color }} />
                    {s.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h4>Commodities by Month</h4>
            </div>
            <div className="card-body">
              <div className="chart-wrap" style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#eef2f6"
                    />
                    <XAxis dataKey="m" />
                    <YAxis />
                    <ReTooltip content={<Tooltip />} />
                    <Legend />
                    <Bar
                      dataKey="llins"
                      stackId="a"
                      fill="#3b82f6"
                      name="LLINs"
                    />
                    <Bar
                      dataKey="repellent"
                      stackId="a"
                      fill="#059669"
                      name="Repellent"
                    />
                    <Bar dataKey="net" stackId="a" fill="#f59e0b" name="Net" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h4>Status by Month</h4>
            </div>
            <div className="card-body">
              <div className="chart-wrap" style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthly}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#eef2f6"
                    />
                    <XAxis dataKey="m" />
                    <YAxis />
                    <ReTooltip content={<Tooltip />} />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h4>Focus</h4>
            </div>
            <div className="card-body split">
              <div className="chart-wrap" style={{ width: 170, height: 170 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={focusSegments}
                      dataKey="value"
                      innerRadius="52%"
                      outerRadius="86%"
                      paddingAngle={6}
                    >
                      {focusSegments.map((s, i) => (
                        <Cell key={i} fill={s.color} />
                      ))}
                    </Pie>
                    <DonutCenterLabel
                      viewBox={{ cx: 85, cy: 85 }}
                      total={focusSegments.reduce((s, x) => s + x.value, 0)}
                    />
                    <ReTooltip content={<Tooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="legend-compact">
                {focusSegments.map((s) => (
                  <li key={s.name}>
                    <span className="dot" style={{ background: s.color }} />
                    {s.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h4>Families</h4>
            </div>
            <div className="card-body">
              <div className="chart-wrap" style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={familiesByMonth}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#eef2f6"
                    />
                    <XAxis dataKey="m" />
                    <YAxis />
                    <ReTooltip content={<Tooltip />} />
                    <Bar
                      dataKey="members"
                      stackId="a"
                      fill="#10b981"
                      name="Members"
                    />
                    <Bar
                      dataKey="household"
                      stackId="a"
                      fill="#3b82f6"
                      name="Household"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h4>Trend</h4>
            </div>
            <div className="card-body">
              <div className="chart-wrap" style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthly}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#eef2f6"
                    />
                    <XAxis dataKey="m" />
                    <YAxis />
                    <ReTooltip content={<Tooltip />} />
                    <Area
                      type="monotone"
                      dataKey="llins"
                      stroke="#f59e0b"
                      fill="#fef3c7"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
