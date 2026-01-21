import React, { useEffect, useMemo, useState } from "react";
import "./Insights.css";
import { getLoops, refreshAll, subscribe } from "../lib/storage";

type RangeKey = "7d" | "14d" | "30d" | "mtd" | "ytd" | "all";
type LoopTypeKey = "single" | "double" | "forecaddie" | "all";

const loopTypeOptions: { key: LoopTypeKey; label: string }[] = [
  { key: "single", label: "Single Bag" },
  { key: "double", label: "Double Bag" },
  { key: "forecaddie", label: "Forecaddie" },
  { key: "all", label: "ALL" },
];

const rangeOptions: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "7D" },
  { key: "14d", label: "14D" },
  { key: "30d", label: "30D" },
  { key: "mtd", label: "MTD" },
  { key: "ytd", label: "YTD" },
  { key: "all", label: "ALL" },
];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfYear(d: Date) {
  return new Date(d.getFullYear(), 0, 1);
}

// Supports "YYYY-MM-DD" and anything Date can parse
function toDate(value: any): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// "HH:MM" or "H:MM" -> minutes from midnight
function timeToMinutes(t?: string): number | null {
  if (!t) return null;
  const parts = String(t).split(":");
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

// consumer-friendly duration: "4h 53m" or "53m"
function fmtDuration(mins: number): string {
  if (!Number.isFinite(mins) || mins <= 0) return "0m";

  const totalMinutes = Math.round(mins);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

const moneyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function safeNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function Insights() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [loopType, setLoopType] = useState<LoopTypeKey>("all");
  const [loops, setLoops] = useState<any[]>([]);

  useEffect(() => {
  setLoops(getLoops());

  refreshAll()
    .then(() => setLoops(getLoops()))
    .catch((e) => console.error("refreshAll failed:", e));

  const unsub = subscribe(() => {
    setLoops(getLoops());
  });

  return () => {
    try {
      unsub?.();
    } catch {}
  };
}, []);

  const filteredLoops = useMemo(() => {
  const now = new Date();
  const todayStart = startOfDay(now);

  let start: Date | null = null;

  if (range === "7d") start = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
  if (range === "14d") start = new Date(todayStart.getTime() - 13 * 24 * 60 * 60 * 1000);
  if (range === "30d") start = new Date(todayStart.getTime() - 29 * 24 * 60 * 60 * 1000);
  if (range === "mtd") start = startOfMonth(now);
  if (range === "ytd") start = startOfYear(now);

  // 1) Date filter (existing behavior)
  const byDate = !start
    ? loops
    : loops.filter((l) => {
        const d = toDate(l.date);
        if (!d) return false;
        return d >= startOfDay(start);
      });

  // 2) Loop-type filter (NEW)
  if (loopType === "all") return byDate;

  return byDate.filter((l: any) => {
    const t = String(l.loopType || l.loop_type || "").toLowerCase();
    if (loopType === "single") return t.includes("single");
    if (loopType === "double") return t.includes("double");
    if (loopType === "forecaddie") return t.includes("fore");
    return true;
  });
}, [loops, range, loopType]);

  const totals = useMemo(() => {
    let bagFees = 0;
    let cashTips = 0;
    let digitalTips = 0;
    let preGrat = 0;

    for (const l of filteredLoops) {
      bagFees += safeNum(l.bagFee);
      cashTips += safeNum(l.cashTip);
      digitalTips += safeNum(l.digitalTip);
      preGrat += safeNum(l.preGrat);
    }

    const totalIncome = bagFees + cashTips + digitalTips + preGrat;
    const totalLoops = filteredLoops.length;

    // Tips % of income includes Pre-Grat + Cash + Digital (NOT bag fees)
    const tipsTotal = cashTips + digitalTips + preGrat;
    const tipsPct = totalIncome > 0 ? (tipsTotal / totalIncome) * 100 : 0;

    // Avg $/loop
    const avgEarningsPerLoop = totalLoops > 0 ? totalIncome / totalLoops : 0;

    // Time-based metrics:
    // On-bag hours: End - Tee
    // Overall hours: End - Report
    // Wait: Tee - Report
    // Pace: End - Tee  (avg per loop)
    let onBagMinutesSum = 0;
    let onBagCount = 0;

    let overallMinutesSum = 0;
    let overallCount = 0;

    let waitMinutesSum = 0;
    let waitCount = 0;

    let paceMinutesSum = 0;
    let paceCount = 0;

    for (const l of filteredLoops) {
      const reportMin = timeToMinutes(l.reportTime);
      const teeMin = timeToMinutes(l.teeTime);
      const endMin = timeToMinutes(l.endTime);

      if (teeMin != null && endMin != null && endMin >= teeMin) {
        const onBag = endMin - teeMin;
        onBagMinutesSum += onBag;
        onBagCount += 1;

        paceMinutesSum += onBag;
        paceCount += 1;
      }

      if (reportMin != null && endMin != null && endMin >= reportMin) {
        overallMinutesSum += endMin - reportMin;
        overallCount += 1;
      }

      if (reportMin != null && teeMin != null && teeMin >= reportMin) {
        waitMinutesSum += teeMin - reportMin;
        waitCount += 1;
      }
    }

    const onBagHours = onBagMinutesSum / 60;
    const overallHours = overallMinutesSum / 60;

    const onBagPerHour = onBagHours > 0 ? totalIncome / onBagHours : 0;
    const overallPerHour = overallHours > 0 ? totalIncome / overallHours : 0;

    const avgWaitMins = waitCount > 0 ? waitMinutesSum / waitCount : 0;
    const avgPaceMins = paceCount > 0 ? paceMinutesSum / paceCount : 0;

    return {
      bagFees,
      cashTips,
      digitalTips,
      preGrat,
      totalIncome,
      totalLoops,
      tipsPct,
      avgEarningsPerLoop,
      onBagPerHour,
      overallPerHour,
      avgWaitMins,
      avgPaceMins,
    };
  }, [filteredLoops]);

  const maxWrapStyle: React.CSSProperties = {
    width: "min(720px, calc(100% - 0px))",
    margin: "0 auto",
  };

  const cardStyle: React.CSSProperties = {
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
  };

  const kpiGridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  };

  const kpiCardStyle: React.CSSProperties = {
    ...cardStyle,
    padding: 14,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    opacity: 0.75,
  };

  const valueStyle: React.CSSProperties = {
    fontSize: 22,
    fontWeight: 800,
    marginTop: 8,
  };

  return (
    <div className="insights-page" style={{ padding: "18px 16px 28px", boxSizing: "border-box" }}>
      <div className="insights-header">
  <h1 className="insights-title">Insights</h1>

  <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
    {/* Date filter row */}
    <div className="insights-filters">
      {rangeOptions.map((r) => (
        <button
          key={r.key}
          className={`insights-filter-pill ${range === r.key ? "active" : ""}`}
          onClick={() => setRange(r.key)}
          type="button"
        >
          {r.label}
        </button>
      ))}
    </div>

    {/* Loop type filter row */}
    <div className="insights-filters">
      {loopTypeOptions.map((t) => (
        <button
          key={t.key}
          className={`insights-filter-pill ${loopType === t.key ? "active" : ""}`}
          onClick={() => setLoopType(t.key)}
          type="button"
        >
          {t.label}
        </button>
      ))}
    </div>
  </div>
</div>

      <div style={maxWrapStyle}>
        {/* TOTAL INCOME (was Range Summary) */}
        <div style={{ ...cardStyle, padding: 18, marginBottom: 12 }}>
          <div style={labelStyle}>TOTAL INCOME</div>
          <div style={{ fontSize: 34, fontWeight: 900, marginTop: 10 }}>
            {moneyFmt.format(totals.totalIncome)}
          </div>
          <div style={{ marginTop: 6, opacity: 0.8 }}>{totals.totalLoops} loops</div>
        </div>

        {/* KPI GRID (no descriptions under metrics) */}
        <div style={kpiGridStyle}>
          <div style={kpiCardStyle}>
            <div style={labelStyle}>AVG EARNINGS / LOOP</div>
            <div style={valueStyle}>{moneyFmt.format(totals.avgEarningsPerLoop)}</div>
          </div>

	<div style={kpiCardStyle}>
            <div style={labelStyle}>TIPS % OF INCOME</div>
            <div style={valueStyle}>{Math.round(totals.tipsPct)}%</div>
          </div>

	<div style={kpiCardStyle}>
            <div style={labelStyle}>OVERALL $ / HOUR</div>
            <div style={valueStyle}>
              {moneyFmt.format(totals.overallPerHour)}
              <span style={{ fontSize: 16, fontWeight: 800, opacity: 0.9 }}>/hr</span>
            </div>
          </div>

          <div style={kpiCardStyle}>
            <div style={labelStyle}>ON-BAG $ / HOUR</div>
            <div style={valueStyle}>
              {moneyFmt.format(totals.onBagPerHour)}
              <span style={{ fontSize: 16, fontWeight: 800, opacity: 0.9 }}>/hr</span>
            </div>
          </div>
	
	<div style={kpiCardStyle}>
            <div style={labelStyle}>AVG PACE OF PLAY</div>
            <div style={valueStyle}>{fmtDuration(totals.avgPaceMins)}</div>
          </div>

          <div style={kpiCardStyle}>
            <div style={labelStyle}>AVG WAIT TIME</div>
            <div style={valueStyle}>{fmtDuration(totals.avgWaitMins)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
