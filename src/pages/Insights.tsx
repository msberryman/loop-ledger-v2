import React, { useEffect, useMemo, useState } from "react";
import "./Insights.css";
import { getLoops, refreshAll, subscribe } from "../lib/storage";

import { PageShell, PageHeader, PillRail, Card, ContentWidth } from "../ui-kit";

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

    // 2) Loop-type filter (existing behavior)
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

    // Time-based metrics
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

  const kpis = [
    { label: "AVG EARNINGS / LOOP", value: moneyFmt.format(totals.avgEarningsPerLoop) },
    { label: "TIPS % OF INCOME", value: `${Math.round(totals.tipsPct)}%` },
    {
      label: "OVERALL $ / HOUR",
      value: (
        <>
          {moneyFmt.format(totals.overallPerHour)}
          <span style={{ fontSize: 16, fontWeight: 800, opacity: 0.9 }}>/hr</span>
        </>
      ),
    },
    {
      label: "ON-BAG $ / HOUR",
      value: (
        <>
          {moneyFmt.format(totals.onBagPerHour)}
          <span style={{ fontSize: 16, fontWeight: 800, opacity: 0.9 }}>/hr</span>
        </>
      ),
    },
    { label: "AVG PACE OF PLAY", value: fmtDuration(totals.avgPaceMins) },
    { label: "AVG WAIT TIME", value: fmtDuration(totals.avgWaitMins) },
  ] as const;

  return (
    <PageShell>
      <ContentWidth>
        <PageHeader
          title="Insights"
          right={
            <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
              <PillRail<RangeKey>
                ariaLabel="Insights date range filter"
                options={rangeOptions}
                value={range}
                onChange={setRange}
              />
              <PillRail<LoopTypeKey>
                ariaLabel="Insights loop type filter"
                options={loopTypeOptions}
                value={loopType}
                onChange={setLoopType}
              />
            </div>
          }
        />
      </ContentWidth>

      <ContentWidth style={{ marginTop: 14 }}>
        <Card>
          <div style={{ fontSize: 12, letterSpacing: 1.4, opacity: 0.7 }}>TOTAL INCOME</div>
          <div style={{ fontSize: 34, fontWeight: 900, marginTop: 10 }}>
            {moneyFmt.format(totals.totalIncome)}
          </div>
          <div style={{ marginTop: 6, opacity: 0.8 }}>{totals.totalLoops} loops</div>
        </Card>
      </ContentWidth>

      <ContentWidth
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        {kpis.map((k) => (
          <Card key={k.label} variant="inner">
            <div style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.75 }}>
              {k.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 8 }}>{k.value}</div>
          </Card>
        ))}
      </ContentWidth>
    </PageShell>
  );
}
