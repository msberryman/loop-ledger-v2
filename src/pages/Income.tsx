import React, { useEffect, useMemo, useState } from "react";
import "./Income.css";
import { getLoops, refreshAll, subscribe } from "../lib/storage";

/* ---------------- Types ---------------- */
type Loop = {
  date: string;
  bagFee: number | string;
  pregrat: number | string;

  // Newer versions store tips as cashTip/digitalTip
  cashTip?: number | string;
  digitalTip?: number | string;

  // Older versions stored tips as tipCash/tipDigital
  tipCash?: number | string;
  tipDigital?: number | string;

  courseName?: string;
  loopType?: string;
};

/* ---------------- Helpers ---------------- */
function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^0-9.\-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

// Safari/iOS can be picky about Date parsing for non-ISO strings.
// We normalize the common formats we store: YYYY-MM-DD and MM/DD/YYYY.
function parseLoopDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== "string") return null;

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const d = new Date(`${dateStr}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // MM/DD/YYYY
  const mdy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const m = Number(mdy[1]);
    const d = Number(mdy[2]);
    const y = Number(mdy[3]);
    const dt = new Date(y, m - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  // Fallback
  const dt = new Date(dateStr);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function formatCurrency(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

/* ---------------- Normalization ---------------- */
function normalizeLoop(loop: Partial<Loop> & Record<string, any>) {
  // Date (support a few potential keys from earlier versions)
  const date =
    (typeof loop.date === "string" && loop.date) ||
    (typeof loop.loopDate === "string" && loop.loopDate) ||
    (typeof loop.loop_date === "string" && loop.loop_date) ||
    "";

  // Income fields (support multiple historical key names)
  const bagFee = num(loop.bagFee ?? loop.bag_fee ?? loop.bagfee ?? loop.bag ?? 0);
  const pregrat = num(loop.pregrat ?? loop.preGrat ?? loop.pre_grat ?? loop.pregrat_amount ?? 0);

  // Tips: newest schema uses cashTip/digitalTip; older schema used tipCash/tipDigital
  const cash = num(
    loop.cashTip ??
      loop.cash_tip ??
      loop.tipCash ??
      loop.tip_cash ??
      loop.cash ??
      0
  );
  const digital = num(
    loop.digitalTip ??
      loop.digital_tip ??
      loop.tipDigital ??
      loop.tip_digital ??
      loop.digital ??
      0
  );

  return {
    date,
    bagFee,
    pregrat,
    tipCash: cash,
    tipDigital: digital,
    courseName: typeof loop.courseName === "string" ? loop.courseName : undefined,
    loopType: typeof loop.loopType === "string" ? loop.loopType : undefined,
  };
}
type NLoop = ReturnType<typeof normalizeLoop>;

/* ---------------- Data source ---------------- */

/* ---------------- Range & math ---------------- */
type RangeKey = "7d" | "14d" | "30d" | "mtd" | "ytd" | "all";
const LABELS: Record<RangeKey, string> = {
  "7d": "7D",
  "14d": "14D",
  "30d": "30D",
  mtd: "MTD",
  ytd: "YTD",
  all: "ALL",
};

const RANGE_KEYS: RangeKey[] = ["7d", "14d", "30d", "mtd", "ytd", "all"];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function rangeStart(range: RangeKey, now = new Date()): Date | null {
  const today = startOfDay(now);

  if (range === "all") return null;
  if (range === "mtd") return new Date(today.getFullYear(), today.getMonth(), 1);
  if (range === "ytd") return new Date(today.getFullYear(), 0, 1);

  const days = range === "7d" ? 6 : range === "14d" ? 13 : 29; // "30d"
  const start = new Date(today);
  start.setDate(today.getDate() - days);
  return start;
}

function filterLoopsByRange(all: NLoop[], range: RangeKey): NLoop[] {
  const start = rangeStart(range);
  if (!start) return all;

  return all.filter((l) => {
    const dt = parseLoopDate(l.date);
    return dt ? dt >= start : false;
  });
}

function summarize(loops: NLoop[]) {
  const bag = loops.reduce((acc, l) => acc + l.bagFee, 0);
  const pre = loops.reduce((acc, l) => acc + l.pregrat, 0);
  const cash = loops.reduce((acc, l) => acc + l.tipCash, 0);
  const digital = loops.reduce((acc, l) => acc + l.tipDigital, 0);
  const total = bag + pre + cash + digital;
  return { bag, pre, cash, digital, total };
}

function pct(part: number, whole: number): string {
  if (whole <= 0) return "0%";
  const p = Math.round((part / whole) * 100);
  return `${p}%`;
}

/* ---------------- Colors (UI only) ---------------- */
const COLORS = {
  bag: "#F59E0B",     // amber
  pre: "#A855F7",     // violet
  cash: "#22C55E",    // green (dominant)
  digital: "#38BDF8", // cyan
} as const;

/* ---------------- Donut ---------------- */
function DonutSVG({
  bag,
  pre,
  cash,
  digital,
  size = 280,
  stroke = 22,
}: {
  bag: number;
  pre: number;
  cash: number;
  digital: number;
  size?: number;
  stroke?: number;
}) {
  const total = bag + pre + cash + digital;

  const segments = [
    { label: "Bag Fees", value: bag, color: COLORS.bag },
    { label: "Pre-Grat", value: pre, color: COLORS.pre },
    { label: "Cash Tips", value: cash, color: COLORS.cash },
    { label: "Digital Tips", value: digital, color: COLORS.digital },
  ];

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={stroke}
      />

      {/* Segments */}
      {segments.map((s) => {
        const share = total > 0 ? s.value / total : 0;
        const len = share * c;

        const node = (
          <circle
            key={s.label}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeLinecap="butt"
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );

        offset += len;
        return node;
      })}

      {/* Center label */}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="white"
        fontSize="22"
        fontWeight="700"
      >
        {formatCurrency(total)}
      </text>
      <text
        x="50%"
        y="58%"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="rgba(255,255,255,0.65)"
        fontSize="12"
      >
        Total
      </text>
    </svg>
  );
}

/* ---------------- Page ---------------- */
export default function IncomePage() {
  const [allLoops, setAllLoops] = useState<NLoop[]>([]);

useEffect(() => {
  // load cache immediately
  setAllLoops(getLoops().map((l: any) => normalizeLoop(l)));

  // then refresh from Supabase
  refreshAll()
    .then(() => setAllLoops(getLoops().map((l: any) => normalizeLoop(l))))
    .catch((e) => console.error("refreshAll failed:", e));

  const unsub = subscribe(() => {
    setAllLoops(getLoops().map((l: any) => normalizeLoop(l)));
  });

  return () => {
    try {
      unsub?.();
    } catch {}
  };
}, []);

  const [range, setRange] = useState<RangeKey>("mtd");

  const loops = useMemo(() => filterLoopsByRange(allLoops, range), [allLoops, range]);
  const sum = useMemo(() => summarize(loops), [loops]);

  const recentIncome = useMemo(() => {
    const toTime = (d: string) => parseLoopDate(d)?.getTime() ?? 0;

    return [...loops]
      .sort((a, b) => toTime(b.date) - toTime(a.date))
      .slice(0, 8)
      .map((l) => ({
        date: l.date,
        total: l.bagFee + l.pregrat + l.tipCash + l.tipDigital,
      }));
  }, [loops]);

  const cardStyle: React.CSSProperties = {
    width: "min(720px, calc(100% - 32px))",
    margin: "0 auto",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 16,
    padding: 18,
    background: "rgba(0,0,0,0.25)",
    boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
  };

  return (
    <div style={{ padding: "18px 16px 28px", color: "white" }}>
      {/* Header + Filters (styled via Income.css) */}
      <div className="income-header">
        <h1 className="income-title">Income</h1>

        <div className="income-filters" role="tablist" aria-label="Income range filter">
          {RANGE_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              className={`income-filter-pill ${range === k ? "active" : ""}`}
              onClick={() => setRange(k)}
            >
              {LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      {/* Total Income */}
      <div style={{ ...cardStyle, marginTop: 14 }}>
        <div style={{ fontSize: 12, letterSpacing: 1.4, opacity: 0.7 }}>TOTAL INCOME</div>
        <div style={{ fontSize: 32, fontWeight: 800, marginTop: 6 }}>{formatCurrency(sum.total)}</div>
        <div style={{ opacity: 0.7, marginTop: 6 }}>{loops.length} loops</div>
      </div>

      {/* Breakdown cards */}
      <div
        style={{
          width: "min(720px, calc(100% - 32px))",
          margin: "14px auto 0",
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        {[
          { title: "BAG FEES", value: sum.bag, color: COLORS.bag },
          { title: "PRE-GRAT", value: sum.pre, color: COLORS.pre },
          { title: "CASH TIPS", value: sum.cash, color: COLORS.cash },
          { title: "DIGITAL TIPS", value: sum.digital, color: COLORS.digital },
        ].map((m) => (
          <div
            key={m.title}
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 14,
              padding: 14,
              background: "rgba(0,0,0,0.18)",
            }}
          >
            <div className="income-metric-title">
              <span>{m.title}</span>
              <span className="income-color-dot" style={{ backgroundColor: m.color }} />
            </div>

            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>{formatCurrency(m.value)}</div>
            <div style={{ opacity: 0.65, marginTop: 4 }}>{pct(m.value, sum.total)} of total</div>
          </div>
        ))}
      </div>

      {/* Donut */}
      <div style={{ ...cardStyle, marginTop: 14, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <DonutSVG bag={sum.bag} pre={sum.pre} cash={sum.cash} digital={sum.digital} />
        </div>
      </div>

      {/* Recent Income */}
      <div style={{ ...cardStyle, marginTop: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>Recent Income</div>

        {recentIncome.length === 0 ? (
          <div style={{ opacity: 0.7 }}>No loops in this range yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {recentIncome.map((r, idx) => (
              <div
                key={`${r.date}-${idx}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                <div style={{ opacity: 0.85 }}>{r.date || "—"}</div>
                <div style={{ fontWeight: 800 }}>{formatCurrency(r.total)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
