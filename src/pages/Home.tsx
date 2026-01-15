import React, { useEffect, useMemo, useState } from "react";
import {
  getLoops,
  getExpenses,
  subscribe,
  getSettings,
  refreshAll,
} from "../lib/storage";
import { useNavigate } from "react-router-dom";
import "./Home.css";

type FilterKey = "7D" | "14D" | "30D" | "MTD" | "YTD" | "ALL";

const MILEAGE_BANNER_DISMISS_KEY = "ll:dismiss_mileage_prompt";

export default function HomePage() {
  const navigate = useNavigate();

  const [loops, setLoops] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);

  const [filter, setFilter] = useState<FilterKey>("14D");

// ---------- UI: mileage prompt + assurance (no math/logic changes) ----------
const [dismissMileagePrompt, setDismissMileagePrompt] = useState(false);

// read once on mount
useEffect(() => {
  try {
    setDismissMileagePrompt(localStorage.getItem(MILEAGE_BANNER_DISMISS_KEY) === "1");
  } catch {
    // no-op (private mode / blocked storage)
  }
}, []);

const hasHomeAddress = Boolean(String(settings?.homeAddress || "").trim());
const showMileagePrompt = !hasHomeAddress && !dismissMileagePrompt;

function handleDismissMileagePrompt() {
  setDismissMileagePrompt(true);
  try {
    localStorage.setItem(MILEAGE_BANNER_DISMISS_KEY, "1");
  } catch {
    // no-op
  }
}

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

    {/* Mileage prompt / assurance (pure UI) */}
    <div className="mileage-status">
      {showMileagePrompt ? (
        <div className="mileage-banner" role="status" aria-live="polite">
          <div className="mileage-banner__row">
            <div className="mileage-banner__text">
              <span className="mileage-banner__title">Mileage not enabled</span>
              <span className="mileage-banner__subtitle">
                To auto-calculate mileage expenses, enter your home address in Settings.
              </span>
            </div>

            <div className="mileage-banner__actions">
              <button
                type="button"
                className="mileage-banner__btn mileage-banner__btn--primary"
                onClick={() => navigate("/settings")}
              >
                Go to Settings
              </button>

              <button
                type="button"
                className="mileage-banner__btn mileage-banner__btn--ghost"
                onClick={handleDismissMileagePrompt}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : hasHomeAddress ? (
        <div className="mileage-assurance" role="status" aria-live="polite">
          <span className="mileage-assurance__dot" aria-hidden="true" />
          Mileage enabled • Home address saved
        </div>
      ) : null}
    </div>

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
    </div>
  );
}

