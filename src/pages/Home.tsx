import React, { useEffect, useMemo, useState } from "react";
import {
  getLoops,
  getExpenses,
  subscribe,
  getSettings,
  refreshAll,
} from "../lib/storage";
import { useNavigate } from "react-router-dom";
import "./Home.css"; // keep for now (low risk), even if not heavily used

import { PageShell, ContentWidth, Card, PillRail, Button } from "../ui-kit";

type FilterKey = "7D" | "14D" | "30D" | "MTD" | "YTD" | "ALL";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "7D", label: "7D" },
  { key: "14D", label: "14D" },
  { key: "30D", label: "30D" },
  { key: "MTD", label: "MTD" },
  { key: "YTD", label: "YTD" },
  { key: "ALL", label: "ALL" },
];

export default function HomePage() {
  const navigate = useNavigate();

  const [loops, setLoops] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);

  // ✅ default to MTD (UI-only)
  const [filter, setFilter] = useState<FilterKey>("MTD");

  const hasHomeAddress = Boolean(String(settings?.homeAddress || "").trim());

  // ---------- LOAD DATA ----------
  useEffect(() => {
    // load from cache first
    setLoops(getLoops());
    setExpenses(getExpenses());
    setSettings(getSettings());

    // then pull from Supabase
    refreshAll().catch((e) => console.error("refreshAll failed:", e));

    const unsub = subscribe(() => {
      setLoops(getLoops());
      setExpenses(getExpenses());
      setSettings(getSettings());
    });

    return () => {
      try {
        unsub?.();
      } catch {
        // no-op
      }
    };
  }, []);

  // ---------- RANGE START ----------
  const rangeStart = useMemo(() => {
    const now = new Date();

    if (filter === "ALL") return new Date(0);

    if (filter === "YTD") return new Date(now.getFullYear(), 0, 1);
    if (filter === "MTD") return new Date(now.getFullYear(), now.getMonth(), 1);

    const days =
      filter === "7D" ? 7 : filter === "14D" ? 14 : filter === "30D" ? 30 : 14;

    const d = new Date(now);
    d.setDate(d.getDate() - days);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [filter]);

  // ---------- FILTERED LOOPS ----------
  const filteredLoops = useMemo(() => {
    if (filter === "ALL") return loops;
    return loops.filter((l: any) => {
      const dt = new Date(l?.date);
      return !isNaN(dt.getTime()) && dt >= rangeStart;
    });
  }, [loops, filter, rangeStart]);

  // ---------- INCOME ----------
  const totalIncome = useMemo(() => {
    return filteredLoops.reduce((sum: number, loop: any) => {
      return (
        sum +
        (Number(loop.bagFee) || 0) +
        (Number(loop.cashTip) || 0) +
        (Number(loop.digitalTip) || 0) +
        (Number(loop.preGrat) || 0)
      );
    }, 0);
  }, [filteredLoops]);

  // ---------- EXPENSES ----------
  const filteredExpenses = useMemo(() => {
    if (filter === "ALL") return expenses;
    return expenses.filter((e: any) => {
      const dt = new Date(e?.date);
      return !isNaN(dt.getTime()) && dt >= rangeStart;
    });
  }, [expenses, filter, rangeStart]);

  const manualExpensesTotal = useMemo(() => {
    return filteredExpenses.reduce(
      (sum: number, e: any) => sum + (Number(e.amount) || 0),
      0
    );
  }, [filteredExpenses]);

  // ---------- MILEAGE EXPENSE ----------
  const mileageTotal = useMemo(() => {
    return filteredLoops.reduce((sum: number, loop: any) => {
      return sum + (Number(loop.mileage_cost) || 0);
    }, 0);
  }, [filteredLoops]);

  const totalExpenses = manualExpensesTotal + mileageTotal;

  // UI-only dot style (same size everywhere)
  const dotStyle: React.CSSProperties = {
    width: 7,
    height: 7,
    borderRadius: 999,
    display: "inline-block",
    background: "rgba(255,255,255,0.70)",
    flex: "0 0 7px",
  };

  return (
    <PageShell>
      <ContentWidth>
        {/* ✅ Custom header row so logo stays right-aligned on mobile and centered with title */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <h1 className="ui-page-title" style={{ margin: 0 }}>
            Home
          </h1>

          <img
            src="/loop-ledger-logo.svg"
            alt="Loop Ledger"
            style={{
              width: 48,
              height: 48,
              borderRadius: 999,
              boxShadow: "0 12px 36px rgba(0,0,0,0.45)",
            }}
          />
        </div>
      </ContentWidth>

      {/* Status / Address requirement banner */}
      <ContentWidth style={{ marginTop: 14 }}>
        {!hasHomeAddress ? (
          <Card>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>
                Address required to log loops
              </div>
              <div style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.25 }}>
                Enter your home address in Settings to enable mileage and log loops.
              </div>

              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => navigate("/settings")}
                >
                  Go to Settings
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card variant="row">
            {/* ✅ One-line on mobile + identical dot sizes + no font mismatch */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                fontWeight: 800,
                opacity: 0.85,
                lineHeight: 1,
                whiteSpace: "nowrap", // ✅ prevents wrapping to 2 lines on mobile
                fontSize: "clamp(12px, 3.2vw, 13px)", // ✅ shrinks slightly on mobile if needed
              }}
            >
              <span aria-hidden="true" style={dotStyle} />
              <span>Mileage enabled</span>
              <span aria-hidden="true" style={dotStyle} />
              <span>Home address saved</span>
            </div>
          </Card>
        )}
      </ContentWidth>

      {/* Filter rail (Income/Insights style) */}
      <ContentWidth style={{ marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <PillRail<FilterKey>
            ariaLabel="Home date range filter"
            options={FILTERS}
            value={filter}
            onChange={setFilter}
          />
        </div>
      </ContentWidth>

      {/* KPI cards (centered) */}
      <ContentWidth style={{ marginTop: 14, display: "grid", gap: 12 }}>
        <Card style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, letterSpacing: 1.4, opacity: 0.7 }}>
            LOOPS COMPLETED
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, marginTop: 6 }}>
            {filteredLoops.length}
          </div>
        </Card>

        <Card style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, letterSpacing: 1.4, opacity: 0.7 }}>
            TOTAL INCOME
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, marginTop: 6 }}>
            ${totalIncome.toFixed(2)}
          </div>
        </Card>

        <Card style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, letterSpacing: 1.4, opacity: 0.7 }}>
            TOTAL EXPENSES
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, marginTop: 6 }}>
            ${totalExpenses.toFixed(2)}
          </div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>
            (includes mileage)
          </div>
        </Card>
      </ContentWidth>

      {/* Actions */}
      <ContentWidth style={{ marginTop: 14 }}>
        <div style={{ display: "grid", gap: 10 }}>
          <Button
            type="button"
            variant="primary"
            onClick={() => navigate("/loops")}
            disabled={!hasHomeAddress}
            title={!hasHomeAddress ? "Add your home address in Settings first" : ""}
            style={{ width: "100%" }}
          >
            Add Loop
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate("/expenses")}
            style={{ width: "100%" }}
          >
            Add Expense
          </Button>
        </div>
      </ContentWidth>
    </PageShell>
  );
}
