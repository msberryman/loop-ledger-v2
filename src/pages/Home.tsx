import React, { useEffect, useState } from "react";
import { getLoops, getExpenses, subscribe, getSettings } from "../lib/storage";
import { useNavigate } from "react-router-dom";
import "./Home.css";

export default function HomePage() {
  const navigate = useNavigate();
  const [loops, setLoops] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [settings, setSettings] = useState(null);

  // ---------- LOAD DATA ----------
  useEffect(() => {
    setLoops(getLoops());
    setExpenses(getExpenses());
    setSettings(getSettings());

    // live updates
    const unsub = subscribe(() => {
      setLoops(getLoops());
      setExpenses(getExpenses());
      setSettings(getSettings());
    });

    return unsub;
  }, []);

  // ---------- DATE FILTER ----------
  const [filter, setFilter] = useState("30D");

  const filterLoops = () => {
    const now = new Date();
    let rangeStart = new Date(0);

    if (filter === "7D") rangeStart = new Date(now.setDate(now.getDate() - 7));
    if (filter === "14D") rangeStart = new Date(now.setDate(now.getDate() - 14));
    if (filter === "30D") rangeStart = new Date(now.setDate(now.getDate() - 30));
    if (filter === "MTD") rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
    if (filter === "YTD") rangeStart = new Date(now.getFullYear(), 0, 1);
    // ALL = everything

    return loops.filter((loop) => {
      const d = new Date(loop.date);
      return d >= rangeStart;
    });
  };

  const filteredLoops = filterLoops();

  // ---------- INCOME ----------
  const totalIncome = filteredLoops.reduce((sum, loop) => {
    return (
      sum +
      (Number(loop.bagFee) || 0) +
      (Number(loop.cashTip) || 0) +
      (Number(loop.digitalTip) || 0) +
      (Number(loop.preGrat) || 0)
    );
  }, 0);

  // ---------- EXPENSES (user-entered expenses ONLY) ----------
  const filteredExpenses = expenses; // no date filter on your UI
  const manualExpensesTotal = filteredExpenses.reduce(
    (sum, e) => sum + (Number(e.amount) || 0),
    0
  );

  // ---------- MILEAGE EXPENSE ----------
  const mileageRate = settings?.mileageRate || 0.655; // safe default
  const mileageTotal = filteredLoops.reduce((sum, loop) => {
    return sum + (Number(loop.mileage_cost) || 0);
  }, 0);

  const totalExpenses = manualExpensesTotal + mileageTotal;

  return (
    <div className="home-container">
      <div className="date-toggle">
        {["7D", "14D", "30D", "MTD", "YTD", "ALL"].map((key) => (
          <button
            key={key}
            className={filter === key ? "selected" : ""}
            onClick={() => setFilter(key)}
          >
            {key}
          </button>
        ))}
      </div>

      <h2 className="home-title">Loop Ledger</h2>

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
            <span style={{ fontSize: "0.8rem" }}>(includes mileage)</span>
          </div>
        </div>
      </div>

      <div className="home-buttons">
        <button onClick={() => navigate("/loops")}>Add Loop</button>
        <button onClick={() => navigate("/expenses")}>Add Expense</button>
      </div>
    </div>
  );
}
