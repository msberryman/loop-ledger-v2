import React, { useEffect, useMemo, useRef, useState } from "react";
import { getExpenses, refreshAll, saveExpense, deleteExpense } from "../lib/storage";

import DateRangeChips from "../components/DateRangeChips";
import { getDateRange } from "../lib/dateRange";
import type { DateRangeKey } from "../lib/dateRange";

import "./Expenses.css";

type Expense = {
  id: string;
  date: string; // YYYY-MM-DD
  vendor?: string;
  description?: string;
  category?: string;
  amount: number;

  // Optional receipt metadata (UI only for now)
  receiptName?: string;
  receiptDataUrl?: string;
};

const CATEGORY_OPTIONS = ["Gear & Supplies", "Food", "Mileage", "Other"] as const;

export default function ExpensesPage() {
  const [rangeKey, setRangeKey] = useState<DateRangeKey>("MTD");
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Form state (order matches your spec)
  const [date, setDate] = useState<string>("");
  const [vendor, setVendor] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  // Receipt state (optional)
  const [receiptName, setReceiptName] = useState<string>("");
  const [receiptDataUrl, setReceiptDataUrl] = useState<string>("");

  const receiptInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const attachInputRef = useRef<HTMLInputElement | null>(null);
  const [showReceiptMenu, setShowReceiptMenu] = useState(false);

  useEffect(() => {
  // load cache immediately
  setExpenses(getExpenses() as Expense[]);

  // then fetch from Supabase into cache
  refreshAll()
    .then(() => setExpenses(getExpenses() as Expense[]))
    .catch((e) => console.error("refreshAll failed:", e));
}, []);

    const filtered = useMemo(() => {
    const { start, end } = getDateRange(rangeKey);

    // getDateRange() may return Date objects; expenses store dates as "YYYY-MM-DD" strings.
    // Normalize to "YYYY-MM-DD" strings so comparisons are valid + build passes.
    const startKey =
      start instanceof Date ? start.toISOString().slice(0, 10) : String(start);
    const endKey =
      end instanceof Date ? end.toISOString().slice(0, 10) : String(end);

    return (expenses || [])
      .filter((e) => e.date >= startKey && e.date <= endKey)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [expenses, rangeKey]);


  async function refresh() {
  await refreshAll();
  setExpenses(getExpenses() as Expense[]);
}

  function onPickReceipt(file?: File | null) {
    if (!file) return;

    setReceiptName(file.name);

    // Read as data URL so we can preview + optionally persist later
    const reader = new FileReader();
    reader.onload = () => setReceiptDataUrl(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  function clearReceipt() {
  setReceiptName("");
  setReceiptDataUrl("");
  if (cameraInputRef.current) cameraInputRef.current.value = "";
  if (attachInputRef.current) attachInputRef.current.value = "";
}

  async function submitExpense() {
  if (!date) return alert("Please enter a date.");
  const amt = parseFloat(amount || "0");
  if (!Number.isFinite(amt) || amt <= 0)
    return alert("Please enter a valid amount.");

  const newExpense: Expense = {
    id: crypto?.randomUUID?.() ? crypto.randomUUID() : String(Date.now()),
    date,
    vendor: vendor.trim() || undefined,
    description: description.trim() || undefined,
    category: category || undefined,
    amount: amt,
    receiptName: receiptName || undefined,
    receiptDataUrl: receiptDataUrl || undefined,
  };

  try {
    // storage.ts maps Expense -> ll_expenses row
    await saveExpense(newExpense);
    await refresh();
  } catch (err) {
    console.error("Save expense failed:", err);
    alert("Failed to save expense. Please try again.");
    return;
  }

  // Reset form
  setDate("");
  setVendor("");
  setAmount("");
  setCategory("");
  setDescription("");
  clearReceipt();
}

  async function removeExpense(id: string) {
  try {
    await deleteExpense(id);
    await refresh();
  } catch (err) {
    console.error("Delete expense failed:", err);
    alert("Failed to delete expense. Please try again.");
  }
}

  return (
    <div className="expPage">
      <div className="expHeaderRow">
        <h1 className="expTitle">Expenses</h1>

        <div className="expFilters">
          <DateRangeChips value={rangeKey} onChange={setRangeKey} />
        </div>
      </div>

      <div className="expCard">
        <div className="expForm">
          {/* Date */}
          <label className="expLabel">
            Date
            <input
              className="expInput"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>

          {/* Vendor */}
          <label className="expLabel">
            Vendor
            <input
              className="expInput"
              type="text"
              placeholder="REI, Walmart, Gas Station…"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
            />
          </label>

          {/* Amount */}
          <label className="expLabel">
            Amount
            <input
              className="expInput"
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>

          {/* Category */}
<label className="expLabel">
  Category
  <select
    className="expSelect"
    value={category}
    onChange={(e) => setCategory(e.target.value)}
  >
    <option value="" disabled>
      Make Selection
    </option>

    {CATEGORY_OPTIONS.map((opt) => (
      <option key={opt} value={opt}>
        {opt}
      </option>
    ))}
  </select>
</label>


          {/* Description */}
          <label className="expLabel">
            Description
            <input
              className="expInput"
              type="text"
              placeholder="Shoes, range balls, Gatorade…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          {/* Receipt */}
<div className="expReceiptRow">
  <input
    ref={cameraInputRef}
    className="expHiddenFile"
    type="file"
    accept="image/*"
    capture="environment"
    onChange={(e) => onPickReceipt(e.target.files?.[0])}
  />
  <input
    ref={attachInputRef}
    className="expHiddenFile"
    type="file"
    accept="image/*"
    onChange={(e) => onPickReceipt(e.target.files?.[0])}
  />

  <div className="expReceiptMenuWrap">
    <button
      type="button"
      className="expSecondaryBtn"
      onClick={() => setShowReceiptMenu((v) => !v)}
    >
      Add Receipt
    </button>

    {showReceiptMenu && (
      <div className="expReceiptMenu">
        <button
          type="button"
          className="expReceiptMenuItem"
          onClick={() => {
            setShowReceiptMenu(false);
            cameraInputRef.current?.click();
          }}
        >
          Take Photo
        </button>

        <button
          type="button"
          className="expReceiptMenuItem"
          onClick={() => {
            setShowReceiptMenu(false);
            attachInputRef.current?.click();
          }}
        >
          Choose Photo
        </button>
      </div>
    )}
  </div>

  {(receiptName || receiptDataUrl) && (
    <button
      type="button"
      className="expGhostBtn"
      onClick={() => {
        setShowReceiptMenu(false);
        clearReceipt();
      }}
    >
      Clear
    </button>
  )}
</div>


          {(receiptName || receiptDataUrl) && (
            <div className="expReceiptMeta">
              <div className="expReceiptName">{receiptName || "Receipt attached"}</div>
              {receiptDataUrl && (
                <img className="expReceiptPreview" src={receiptDataUrl} alt="Receipt preview" />
              )}
            </div>
          )}

          <button type="button" className="expPrimaryBtn" onClick={submitExpense}>
            Add Expense
          </button>
        </div>
      </div>

      <div className="expList">
        {filtered.map((e) => (
          <div className="expItem" key={e.id}>
            <div className="expItemTop">
              <div className="expItemLeft">
                <div className="expItemVendor">{e.vendor || "—"}</div>
                <div className="expItemMeta">
                  <span>{e.category || "Other"}</span>
                  <span className="expDot">•</span>
                  <span>{e.description || "—"}</span>
                </div>
              </div>

              <div className="expItemRight">
                <div className="expItemAmount">${(e.amount ?? 0).toFixed(2)}</div>
                <div className="expItemDate">{e.date}</div>
              </div>
            </div>

            <button className="expDangerBtn" onClick={() => removeExpense(e.id)}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

