import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

/* ---------------- Types & helpers ---------------- */
export type Loop = {
  id: string;
  date: string; // ISO

  // bag fee (various keys we've seen)
  bagFee?: number | string;
  bag_fee?: number | string;

  // tips (separate fields)
  tipCash?: number | string;
  tip_cash?: number | string;
  tipDigital?: number | string;
  tip_digital?: number | string;

  // tips (single amount + method/type)
  tip?: number | string;
  tipAmount?: number | string;
  tipType?: string;      // "Cash" | "Digital"
  tip_type?: string;     // "cash" | "digital"
  tip_method?: string;   // "cash" | "digital"

  // pre-grat variations
  preGrat?: number | string;
  pre_grat?: number | string;
  pregrat?: number | string;

  courseName?: string;
  loopType?: "single" | "double" | "forecaddie" | string;
};

const toUSD = (n: number) =>
  n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const parseISO = (s?: string) => (s ? new Date(s) : new Date());

/** Robust numeric parser – handles "$64", "64.00", 64, etc. */
const num = (v: unknown): number => {
  if (v == null) return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const cleaned = String(v).replace(/[^0-9.\-]/g, "");
  const n = Number(cleaned);
  return isFinite(n) ? n : 0;
};

function normalizeLoop(loop: Loop) {
  const bag = Math.max(0, num(loop.bagFee ?? loop.bag_fee));

  // explicit split fields first
  const explicitCash = Math.max(0, num(loop.tipCash ?? loop.tip_cash));
  const explicitDigital = Math.max(0, num(loop.tipDigital ?? loop.tip_digital));
  const hasExplicit = explicitCash > 0 || explicitDigital > 0;

  let cash = explicitCash;
  let digital = explicitDigital;

  // single tip amount (old schema)
  const singleTip = num(loop.tip ?? loop.tipAmount);
  const method = (loop.tipType ?? loop.tip_type ?? loop.tip_method ?? "")
    .toString()
    .trim()
    .toLowerCase();

  // 🔑 If we DON'T already have explicit cash/digital, derive from singleTip
  if (!hasExplicit && singleTip > 0) {
    if (method.startsWith("cash")) {
      cash = singleTip;
    } else if (method.startsWith("digit")) {
      digital = singleTip;
    } else {
      // default to digital if unspecified
      digital = singleTip;
    }
  }

  // Pre-Grat
  const pregrat = Math.max(0, num(loop.preGrat ?? loop.pre_grat ?? loop.pregrat));

  return {
    id: String(loop.id),
    date: parseISO(loop.date),
    bagFee: bag,
    pregrat,
    tipCash: cash,
    tipDigital: digital,
    courseName: loop.courseName ?? undefined,
    loopType: loop.loopType ?? undefined,
  };
}

/* --------------- Data source --------------- */
type NLoop = ReturnType<typeof normalizeLoop>;
function useAllLoops(): NLoop[] {
  const [loops, setLoops] = useState<NLoop[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("loops");
      const parsed = raw ? (JSON.parse(raw) as any[]) : [];
      setLoops(parsed.map((l) => normalizeLoop(l as Loop)));
    } catch {
      setLoops([]);
    }
  }, []);
  return loops;
}

/* ---------------- Range & math ---------------- */
type RangeKey = "mtd" | "last20" | "all";
const LABELS: Record<RangeKey, string> = {
  mtd: "Month-to-Date",
  last20: "Last 20",
  all: "All",
};

const startOfMonth = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth(), 1);

const filterLoops = (loops: NLoop[], key: RangeKey) => {
  if (key === "all") return loops;
  if (key === "last20")
    return [...loops]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 20);
  const s = startOfMonth(new Date());
  return loops.filter((l) => l.date.getTime() >= s.getTime());
};

function summarize(loops: NLoop[]) {
  const t = loops.reduce(
    (acc, l) => {
      acc.bag += l.bagFee;
      acc.pregrat += l.pregrat;
      acc.cash += l.tipCash;
      acc.digital += l.tipDigital;
      acc.count++;
      return acc;
    },
    { bag: 0, pregrat: 0, cash: 0, digital: 0, count: 0 }
  );
  const totalIncome = t.bag + t.pregrat + t.cash + t.digital;
  const avgPerLoop = t.count ? totalIncome / t.count : 0;
  return { ...t, totalIncome, avgPerLoop };
}

/* ---------------- UI bits ---------------- */
const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className = "",
  children,
}) => (
  <div
    style={{
      borderRadius: 16,
      border: "1px solid rgba(120,120,120,.25)",
      overflow: "hidden",
      background: "transparent",
    }}
    className={className}
  >
    {children}
  </div>
);

const CardBody: React.FC<{
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ className = "", style, children }) => (
  <div style={{ padding: 16, ...style }} className={className}>
    {children}
  </div>
);

const COLORS = {
  bag: "#60a5fa", // blue-400
  pre: "#a78bfa", // violet-400
  cash: "#34d399", // emerald-400
  digital: "#fbbf24", // amber-400
  track: "rgba(120,120,120,.25)",
  textSub: "rgb(160,160,160)",
};

const Row = ({
  label,
  value,
  pct,
  color,
}: {
  label: string;
  value: number;
  pct: string;
  color: string;
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{ width: 12, height: 12, borderRadius: 3, background: color }}
      />
      <span style={{ fontSize: 14 }}>{label}</span>
      <span style={{ fontSize: 14, color: COLORS.textSub }}>{pct}%</span>
    </div>
    <div style={{ fontWeight: 600 }}>{toUSD(value)}</div>
  </div>
);

/* ---------------- Pure SVG Donut (4 segments) ---------------- */
function DonutSVG({
  bag,
  pregrat,
  cash,
  digital,
  total,
  label,
}: {
  bag: number;
  pregrat: number;
  cash: number;
  digital: number;
  total: number;
  label: string;
}) {
  const size = 260;
  const stroke = 28;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  const p = {
    bag: total ? bag / total : 0,
    pre: total ? pregrat / total : 0,
    cash: total ? cash / total : 0,
    dig: total ? digital / total : 0,
  };
  const len = {
    bag: c * p.bag,
    pre: c * p.pre,
    cash: c * p.cash,
    dig: c * p.dig,
  };

  const rot = `rotate(-90 ${size / 2} ${size / 2})`;
  let offset = 0;

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        margin: "0 auto",
      }}
    >
      <svg width={size} height={size}>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={COLORS.track}
          strokeWidth={stroke}
          fill="none"
          transform={rot}
        />

        {/* Bag Fees */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={COLORS.bag}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${len.bag} ${c - len.bag}`}
          strokeDashoffset={-offset}
          transform={rot}
        />
        {(() => {
          offset += len.bag;
          return null;
        })()}

        {/* Pre-Grat */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={COLORS.pre}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${len.pre} ${c - len.pre}`}
          strokeDashoffset={-offset}
          transform={rot}
        />
        {(() => {
          offset += len.pre;
          return null;
        })()}

        {/* Cash Tips */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={COLORS.cash}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${len.cash} ${c - len.cash}`}
          strokeDashoffset={-offset}
          transform={rot}
        />
        {(() => {
          offset += len.cash;
          return null;
        })()}

        {/* Digital Tips */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={COLORS.digital}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${len.dig} ${c - len.dig}`}
          strokeDashoffset={-offset}
          transform={rot}
        />
      </svg>

      {/* Center label */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 800 }}>{toUSD(total)}</div>
        <div style={{ fontSize: 12, color: COLORS.textSub }}>{label}</div>
      </div>
    </div>
  );
}

/* ---------------- Page ---------------- */
export default function IncomePage() {
  const allLoops = useAllLoops();
  const [range, setRange] = useState<RangeKey>("mtd");

  const loops = useMemo(() => filterLoops(allLoops, range), [allLoops, range]);
  const sum = useMemo(() => summarize(loops), [loops]);

  const pct = (n: number) =>
    sum.totalIncome ? ((n / sum.totalIncome) * 100).toFixed(0) : "0";

  return (
    <div
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "16px 16px 48px",
        display: "grid",
        gap: 24,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>Income</h1>

        {/* Range pills */}
        <div style={{ display: "flex", gap: 12 }}>
          <div
            style={{
              display: "inline-flex",
              gap: 6,
              padding: 4,
              borderRadius: 999,
              border: "1px solid rgba(120,120,120,.35)",
              background: "rgba(120,120,120,.12)",
            }}
          >
            {(["mtd", "last20", "all"] as RangeKey[]).map((k) => {
              const active = range === k;
              return (
                <button
                  key={k}
                  onClick={() => setRange(k)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    fontSize: 14,
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    background: active ? "#3b82f6" : "transparent",
                    color: active ? "#ffffff" : "#cbd5e1",
                    transition: "background .15s ease",
                  }}
                >
                  {k === "mtd" ? "MTD" : k === "last20" ? "Last 20" : "All"}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2,1fr)",
          gap: 12,
        }}
      >
        {/* TOTAL: span full row */}
        <div style={{ gridColumn: "1 / -1" }}>
          <Card>
            <CardBody>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                  color: COLORS.textSub,
                }}
              >
                TOTAL INCOME
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 28,
                  fontWeight: 800,
                }}
              >
                {toUSD(sum.totalIncome)}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  color: COLORS.textSub,
                }}
              >
                {loops.length} loops • {LABELS[range]}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Bag Fees */}
        <Card>
          <CardBody>
            <div
              style={{
                fontSize: 11,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                color: COLORS.textSub,
              }}
            >
              BAG FEES
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 24,
                fontWeight: 700,
              }}
            >
              {toUSD(sum.bag)}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color: COLORS.textSub,
              }}
            >
              {(
                sum.totalIncome
                  ? (sum.bag / sum.totalIncome) * 100
                  : 0
              ).toFixed(0)}
              % of total
            </div>
          </CardBody>
        </Card>

        {/* Pre-Grat */}
        <Card>
          <CardBody>
            <div
              style={{
                fontSize: 11,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                color: COLORS.textSub,
              }}
            >
              PRE-GRAT
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 24,
                fontWeight: 700,
              }}
            >
              {toUSD(sum.pregrat)}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color: COLORS.textSub,
              }}
            >
              {(
                sum.totalIncome
                  ? (sum.pregrat / sum.totalIncome) * 100
                  : 0
              ).toFixed(0)}
              % of total
            </div>
          </CardBody>
        </Card>

        {/* Cash Tips */}
        <Card>
          <CardBody>
            <div
              style={{
                fontSize: 11,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                color: COLORS.textSub,
              }}
            >
              CASH TIPS
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 24,
                fontWeight: 700,
              }}
            >
              {toUSD(sum.cash)}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color: COLORS.textSub,
              }}
            >
              {(
                sum.totalIncome
                  ? (sum.cash / sum.totalIncome) * 100
                  : 0
              ).toFixed(0)}
              % of total
            </div>
          </CardBody>
        </Card>

        {/* Digital Tips */}
        <Card>
          <CardBody>
            <div
              style={{
                fontSize: 11,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                color: COLORS.textSub,
              }}
            >
              DIGITAL TIPS
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 24,
                fontWeight: 700,
              }}
            >
              {toUSD(sum.digital)}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color: COLORS.textSub,
              }}
            >
              {(
                sum.totalIncome
                  ? (sum.digital / sum.totalIncome) * 100
                  : 0
              ).toFixed(0)}
              % of total
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Donut + Breakdown */}
      <Card>
        <CardBody>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 24,
              alignItems: "center",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: 24,
              }}
            >
              <DonutSVG
                bag={sum.bag}
                pregrat={sum.pregrat}
                cash={sum.cash}
                digital={sum.digital}
                total={sum.totalIncome}
                label="Total"
              />
              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 14, color: COLORS.textSub }}>
                    {LABELS[range]}
                  </div>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 700,
                      marginTop: 4,
                    }}
                  >
                    {toUSD(sum.totalIncome)}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: COLORS.textSub,
                      marginTop: 4,
                    }}
                  >
                    Avg / Loop:{" "}
                    {toUSD(Math.round(sum.avgPerLoop || 0))}
                  </div>
                </div>
                <div
                  style={{
                    height: 1,
                    background: "rgba(120,120,120,.25)",
                  }}
                />
                <div style={{ display: "grid", gap: 10 }}>
                  <Row
                    label="Bag Fees"
                    value={sum.bag}
                    pct={pct(sum.bag)}
                    color={COLORS.bag}
                  />
                  <Row
                    label="Pre-Grat"
                    value={sum.pregrat}
                    pct={pct(sum.pregrat)}
                    color={COLORS.pre}
                  />
                  <Row
                    label="Cash Tips"
                    value={sum.cash}
                    pct={pct(sum.cash)}
                    color={COLORS.cash}
                  />
                  <Row
                    label="Digital Tips"
                    value={sum.digital}
                    pct={pct(sum.digital)}
                    color={COLORS.digital}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Recent Loops */}
      <Card>
        <CardBody className="no-padding">
          <div
            style={{
              padding: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              Most Recent Loops
            </div>
            <span
              style={{
                padding: "3px 8px",
                fontSize: 12,
                borderRadius: 999,
                background: "rgba(120,120,120,.15)",
                color: "rgba(200,200,200,.9)",
              }}
            >
              {loops.length} shown
            </span>
          </div>
          <div
            style={{
              height: 1,
              background: "rgba(120,120,120,.25)",
            }}
          />
          <div>
            {[...loops]
              .sort((a, b) => b.date.getTime() - a.date.getTime())
              .slice(0, 5)
              .map((l) => (
                <div
                  key={l.id}
                  style={{
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderTop: "1px solid rgba(120,120,120,.12)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 3,
                        background: COLORS.bag,
                      }}
                    />
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      {l.courseName ?? "Loop"}
                    </div>
                    {l.loopType && (
                      <span
                        style={{
                          padding: "2px 6px",
                          fontSize: 11,
                          borderRadius: 999,
                          background: "rgba(120,120,120,.15)",
                          color: "rgba(200,200,200,.9)",
                        }}
                      >
                        {l.loopType}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: COLORS.textSub,
                    }}
                  >
                    {l.date.toLocaleDateString()} •{" "}
                    {toUSD(
                      l.bagFee + l.pregrat + l.tipCash + l.tipDigital
                    )}
                  </div>
                </div>
              ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

