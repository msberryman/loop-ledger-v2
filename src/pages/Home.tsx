import React, { useEffect, useMemo, useState } from "react";
import { getLoops, getExpenses, subscribe, getSettings } from "../lib/storage";
import { useNavigate } from "react-router-dom";
import "./Home.css";

type FilterKey = "7D" | "14D" | "30D" | "MTD" | "YTD" | "ALL";

export default function HomePage() {
  const navigate = useNavigate();

  const [loops, setLoops] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);

  const [filter, setFilter] = useState<FilterKey>("14D");

  // ---------- LOAD DATA ----------
  useEffect(() => {
    setLoops(getLoops());
    setExpenses(getExpenses());
    setSettings(getSettings());

    const unsub = subscribe(() => {
      setLoops(getLoops());
      setExpenses(getExpenses());
      setSettings(getSettings());
    });

    return () => {
      // cleanup must be a function (NOT JSX)
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

    if (filter === "YTD") {
      return new Date(now.getFullYear(), 0, 1);
    }

    if (filter === "MTD") {
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }

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

  // ---------- EXPENSES (user-entered expenses ONLY) ----------
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

  // ---------- UI ONLY ----------
  return (
    <div className="home-container">
      <h2 className="home-title">Loop Ledger</h2>

      <div className="date-toggle">
        {(["7D", "14D", "30D", "MTD", "YTD", "ALL"] as FilterKey[]).map((key) => (
          <button
            key={key}
            className={filter === key ? "selected" : ""}
            onClick={() => setFilter(key)}
            type="button"
          >
            {key}
          </button>
        ))}
      </div>

      <div className="stats-container">
        <div className="stat-box">
          <div className="stat-number">{filteredLoops.length}</div>
          <div className="stat-label">Loops Completed</div>
        </div>

        <div className="stat-box">
          <div className="stat-number">${totalIncome.toFixed(2)}</div>
          <div className="stat-label">Total Income</div>
        </div>

        <div className="stat-box">
          <div className="stat-number">${totalExpenses.toFixed(2)}</div>
          <div className="stat-label">
            Total Expenses
            <br />
            <span className="stat-sublabel">(includes mileage)</span>
          </div>
        </div>
      </div>

      <div className="home-buttons">
        <button onClick={() => navigate("/loops")} type="button">
          Add Loop
        </button>
        <button onClick={() => navigate("/expenses")} type="button">
          Add Expense
        </button>
      </div>
                {/* TEMP DEBUG BLOCK — REMOVE AFTER DEBUGGING */}
      <pre
        style={{
          marginTop: 16,
          padding: 12,
          background: "#111",
          color: "#0f0",
          fontSize: 12,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {JSON.stringify(
          {
            ua: navigator.userAgent,
            homeSettings: localStorage.getItem("ll_user_settings"),
            loops_ll: localStorage.getItem("ll_loops"),
            loops: localStorage.getItem("loops"),
            tips: localStorage.getItem("tips"),
            allKeys: Object.keys(localStorage),
          },
          null,
          2
        )}
      </pre>
    </div>
  );
}

