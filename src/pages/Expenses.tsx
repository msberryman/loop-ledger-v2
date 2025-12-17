import React, { useState, useEffect } from "react";
import { getExpenses, addExpense, deleteExpense, newId } from "../lib/storage";

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);

  const [form, setForm] = useState({
    date: "",
    vendor: "",
    description: "",
    category: "",
    amount: "",
  });

  // Load stored expenses on mount
  useEffect(() => {
    const stored = getExpenses();
    if (Array.isArray(stored)) setExpenses(stored);
  }, []);

  function fmtMoney(v) {
    if (!v || isNaN(v)) return "$0";
    return "$" + Number(v).toFixed(0);
  }

  function submitExpense() {
    if (!form.date || !form.amount) {
      alert("Please include at least date and amount.");
      return;
    }

    const newItem = {
      id: newId(),
      ...form,
      amount: Number(form.amount),
    };

    addExpense(newItem);
    setExpenses(getExpenses());

    setForm({
      date: "",
      vendor: "",
      description: "",
      category: "",
      amount: "",
    });
  }

  function removeExpense(id) {
    if (window.confirm("Delete this expense?")) {
      deleteExpense(id);
      setExpenses(getExpenses());
    }
  }

  return (
    <div style={{ padding: "20px" }}>
      <h2>Expenses</h2>

      <div style={{ marginBottom: "20px" }}>
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          placeholder="Date"
          style={{ width: "100%", marginBottom: "10px" }}
        />

        <input
          type="text"
          value={form.vendor}
          onChange={(e) => setForm({ ...form, vendor: e.target.value })}
          placeholder="Vendor"
          style={{ width: "100%", marginBottom: "10px" }}
        />

        <input
          type="text"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Description"
          style={{ width: "100%", marginBottom: "10px" }}
        />

        <input
          type="text"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          placeholder="Category"
          style={{ width: "100%", marginBottom: "10px" }}
        />

        <input
          type="number"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          placeholder="Amount"
          style={{
            width: "100%",
            marginBottom: "10px",
            appearance: "textfield",
          }}
          inputMode="decimal"
        />

        <button
          onClick={submitExpense}
          style={{
            width: "100%",
            padding: "10px",
            background: "#4A9",
            border: "none",
            borderRadius: "8px",
          }}
        >
          Add Expense
        </button>
      </div>

      {expenses.length === 0 && <p>No expenses yet.</p>}

      {expenses.map((exp) => (
        <div
          key={exp.id}
          style={{
            background: "#222",
            padding: "12px",
            marginBottom: "10px",
            borderRadius: "8px",
          }}
        >
          <div>
            <strong>{exp.vendor || "(no vendor)"}</strong>
          </div>
          <div>{exp.description || "(no description)"}</div>
          <div>{exp.category || "(no category)"}</div>
          <div>{fmtMoney(exp.amount)}</div>
          <div style={{ fontSize: "12px", color: "#888" }}>{exp.date}</div>

          <button
            onClick={() => removeExpense(exp.id)}
            style={{
              marginTop: "8px",
              width: "100%",
              padding: "6px",
              background: "#A33",
              border: "none",
              borderRadius: "6px",
            }}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
