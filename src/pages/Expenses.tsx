import React, { useEffect, useMemo, useRef, useState } from "react";
import { getExpenses, refreshAll, saveExpense, deleteExpense } from "../lib/storage";

import { getDateRange, type DateRangeKey } from "../lib/dateRange";

import "./Expenses.css";

import { PageShell, ContentWidth, Card, Button as UiButton, PillRail } from "../ui-kit";

type Expense = {
  id: string;
  date: string; // YYYY-MM-DD
  vendor?: string;
  description?: string;
  category?: string;
  amount: number;

  receiptName?: string;
  receiptDataUrl?: string;
};

const CATEGORY_OPTIONS = ["Gear & Supplies", "Food", "Mileage", "Other"] as const;

function uuidv4(): string {
  if (typeof crypto !== "undefined" && typeof (crypto as any).randomUUID === "function") {
    return (crypto as any).randomUUID();
  }

  const bytes =
    typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function"
      ? crypto.getRandomValues(new Uint8Array(16))
      : Uint8Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuidLike(s: string) {
  return UUID_RE.test(String(s || "").trim());
}

function formatMMDDYYYY(iso: string) {
  const s = String(iso || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    return `${m}-${d}-${y}`;
  }
  return s || "—";
}

function isImageLikeUrl(s: string) {
  const v = String(s || "").trim();
  if (!v) return false;
  if (v.startsWith("data:image/")) return true;
  const lower = v.toLowerCase();
  return (
    (lower.startsWith("http://") || lower.startsWith("https://")) &&
    (lower.includes("image") || lower.match(/\.(png|jpg|jpeg|webp|gif)(\?|$)/))
  );
}

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

  // Past Expenses: expandable/collapsible cards
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Full-screen receipt modal
  const [receiptModalUrl, setReceiptModalUrl] = useState<string | null>(null);
  const [receiptModalName, setReceiptModalName] = useState<string>("");

  useEffect(() => {
    setExpenses(getExpenses() as Expense[]);

    refreshAll()
      .then(() => setExpenses(getExpenses() as Expense[]))
      .catch((e) => console.error("refreshAll failed:", e));
  }, []);

  const filtered = useMemo(() => {
    const { start, end } = getDateRange(rangeKey);
    const startKey = start instanceof Date ? start.toISOString().slice(0, 10) : String(start);
    const endKey = end instanceof Date ? end.toISOString().slice(0, 10) : String(end);

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
    if (!Number.isFinite(amt) || amt <= 0) return alert("Please enter a valid amount.");

    const newExpense: Expense = {
      id: uuidv4(),
      date,
      vendor: vendor.trim() || undefined,
      description: description.trim() || undefined,
      category: category || undefined,
      amount: amt,
      receiptName: receiptName || undefined,
      receiptDataUrl: receiptDataUrl || undefined,
    };

    try {
      await saveExpense(newExpense);
      await refresh();
    } catch (err) {
      console.error("Save expense failed:", err);
      alert("Failed to save expense. Please try again.");
      return;
    }

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

  const cardTitle = (e: Expense) => {
    const v = String(e.vendor || "").trim();
    const d = String(e.description || "").trim();
    const c = String(e.category || "").trim();

    if (v && !isUuidLike(v)) return v;
    if (d && !isUuidLike(d)) return d;
    if (c) return c;
    return "Expense";
  };

  // ---------- UI-only styles ----------
  const fieldWrap: React.CSSProperties = { display: "grid", gap: 8, width: "100%", minWidth: 0 };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    opacity: 0.75,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    display: "block",
    boxSizing: "border-box",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.04)",
    color: "inherit",
    outline: "none",
  };

  const selectStyle: React.CSSProperties = { ...inputStyle, appearance: "auto" };

  const nativeShell: React.CSSProperties = {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.04)",
    overflow: "hidden",
    WebkitMaskImage: "-webkit-radial-gradient(white, black)",
  };

  const nativeInner: React.CSSProperties = {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    display: "block",
    boxSizing: "border-box",
    border: "none",
    outline: "none",
    background: "transparent",
    borderRadius: 0,
    color: "inherit",
    padding: "12px 14px",
  };

  const twoCol: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  };

  const moneyTile: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 14,
    padding: 12,
    background: "rgba(0,0,0,0.18)",
    minWidth: 0,
  };

  const moneyRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, marginTop: 6 };

  const moneyInput: React.CSSProperties = {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.04)",
    color: "inherit",
    outline: "none",
    fontWeight: 800,
  };

  const railScaleWrap: React.CSSProperties = {
    display: "inline-block",
    width: "fit-content",
    maxWidth: "100%",
    transform: "scale(0.96)",
    transformOrigin: "center",
  };

  return (
    <PageShell>
      <ContentWidth>
        <h1 className="ui-page-title" style={{ margin: 0 }}>
          Expenses
        </h1>
      </ContentWidth>

      {/* ---------------- ADD EXPENSE (UNCHANGED) ---------------- */}
      <ContentWidth style={{ marginTop: 14 }}>
        <Card>
          <div style={{ fontSize: 12, letterSpacing: 1.4, opacity: 0.7 }}>ADD EXPENSE</div>

          <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
            <div style={fieldWrap}>
              <div style={labelStyle}>Date</div>
              <div style={nativeShell}>
                <input className="ll-date-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={nativeInner} />
              </div>
            </div>

            <div style={fieldWrap}>
              <div style={labelStyle}>Vendor</div>
              <input type="text" placeholder="REI, Walmart, Gas Station…" value={vendor} onChange={(e) => setVendor(e.target.value)} style={inputStyle} />
            </div>

            <div style={twoCol}>
              <div style={fieldWrap}>
                <div style={labelStyle}>Category</div>
                <select value={category} onChange={(e) => setCategory(e.target.value)} style={selectStyle}>
                  <option value="" disabled>
                    Make Selection
                  </option>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div style={fieldWrap}>
                <div style={labelStyle}>Description</div>
                <input type="text" placeholder="Shoes, range balls, Gatorade…" value={description} onChange={(e) => setDescription(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div style={moneyTile}>
              <div style={labelStyle}>Amount</div>
              <div style={moneyRow}>
                <span style={{ opacity: 0.75, fontWeight: 900 }}>$</span>
                <input type="number" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} style={moneyInput} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <input ref={cameraInputRef} className="expHiddenFile" type="file" accept="image/*" capture="environment" onChange={(e) => onPickReceipt(e.target.files?.[0])} />
              <input ref={attachInputRef} className="expHiddenFile" type="file" accept="image/*" onChange={(e) => onPickReceipt(e.target.files?.[0])} />
              <input ref={receiptInputRef} className="expHiddenFile" type="file" accept="image/*" />

              <div style={{ position: "relative" }}>
                <UiButton type="button" variant="secondary" onClick={() => setShowReceiptMenu((v) => !v)}>
                  Add Receipt
                </UiButton>

                {showReceiptMenu && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 8px)",
                      left: 0,
                      zIndex: 30,
                      border: "1px solid rgba(255,255,255,0.14)",
                      background: "rgba(10,10,12,0.92)",
                      borderRadius: 12,
                      overflow: "hidden",
                      minWidth: 180,
                      boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setShowReceiptMenu(false);
                        cameraInputRef.current?.click();
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 12px",
                        border: "none",
                        background: "transparent",
                        color: "rgba(255,255,255,0.92)",
                        cursor: "pointer",
                      }}
                    >
                      Take Photo
                    </button>
                    <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />
                    <button
                      type="button"
                      onClick={() => {
                        setShowReceiptMenu(false);
                        attachInputRef.current?.click();
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 12px",
                        border: "none",
                        background: "transparent",
                        color: "rgba(255,255,255,0.92)",
                        cursor: "pointer",
                      }}
                    >
                      Choose Photo
                    </button>
                  </div>
                )}
              </div>

              {(receiptName || receiptDataUrl) && (
                <UiButton type="button" variant="secondary" onClick={clearReceipt}>
                  Clear
                </UiButton>
              )}
            </div>

            {(receiptName || receiptDataUrl) && (
              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 14,
                  padding: 12,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.9 }}>{receiptName || "Receipt attached"}</div>
                {receiptDataUrl && (
                  <img
                    src={receiptDataUrl}
                    alt="Receipt preview"
                    style={{
                      marginTop: 10,
                      width: "100%",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.10)",
                    }}
                  />
                )}
              </div>
            )}

            <UiButton type="button" variant="primary" onClick={submitExpense} style={{ width: "100%" }}>
              Add Expense
            </UiButton>
          </div>
        </Card>
      </ContentWidth>

      {/* Divider */}
      <ContentWidth style={{ marginTop: 18 }}>
        <div style={{ height: 1, background: "rgba(255,255,255,0.10)", width: "100%", margin: "6px 0 16px" }} />
      </ContentWidth>

      {/* ---------------- PAST EXPENSES (NOW ACTUALLY WORKS) ---------------- */}
      <ContentWidth>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>Past Expenses</h2>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 12, marginBottom: 12 }}>
          <div style={railScaleWrap}>
            <PillRail<DateRangeKey>
              ariaLabel="Past expenses date range filter"
              options={[
                { key: "7D", label: "7D" },
                { key: "14D", label: "14D" },
                { key: "30D", label: "30D" },
                { key: "MTD", label: "MTD" },
                { key: "YTD", label: "YTD" },
                { key: "ALL", label: "ALL" },
              ]}
              value={rangeKey}
              onChange={setRangeKey}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ opacity: 0.7, textAlign: "center" }}>No expenses in this range.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {filtered.map((e) => {
              const isOpen = expandedIds.has(e.id);
              const amt = Number(e.amount ?? 0);
              const title = cardTitle(e);
              const desc = String(e.description || "").trim();
              const receiptUrl = String(e.receiptDataUrl || "").trim();
              const receiptLabel = String(e.receiptName || "").trim();

              return (
                <Card key={e.id}>
                  {/* Collapsed: Title + Amount */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ minWidth: 0, flex: 1, fontWeight: 900, fontSize: 16, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {title}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: 16, whiteSpace: "nowrap" }}>${amt.toFixed(2)}</div>

                      <button
                        type="button"
                        onClick={() => toggleExpanded(e.id)}
                        aria-label={isOpen ? "Collapse expense details" : "Expand expense details"}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "rgba(255,255,255,0.78)",
                          cursor: "pointer",
                          padding: 4,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path
                            d={isOpen ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"}
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {isOpen ? (
                    <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>
                        {formatMMDDYYYY(e.date)} • {String(e.category || "Other")}
                      </div>

                      <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.35 }}>{desc || "—"}</div>

                      {receiptUrl && isImageLikeUrl(receiptUrl) ? (
                        <div style={{ display: "grid", gap: 8 }}>
                          <div style={{ fontSize: 12, opacity: 0.75 }}>
                            Receipt{receiptLabel ? `: ${receiptLabel}` : ""}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setReceiptModalUrl(receiptUrl);
                              setReceiptModalName(receiptLabel || "Receipt");
                            }}
                            style={{ border: "none", padding: 0, background: "transparent", cursor: "pointer", width: "fit-content" }}
                          >
                            <img
                              src={receiptUrl}
                              alt="Receipt thumbnail"
                              style={{
                                width: 96,
                                height: 96,
                                objectFit: "cover",
                                borderRadius: 12,
                                border: "1px solid rgba(255,255,255,0.10)",
                              }}
                            />
                          </button>
                        </div>
                      ) : null}

                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 2 }}>
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            removeExpense(e.id);
                          }}
                          aria-label="Delete expense"
                          title="Delete"
                          style={{
                            border: "1px solid rgba(239,68,68,0.7)",
                            background: "transparent",
                            color: "rgba(239,68,68,0.95)",
                            borderRadius: 12,
                            width: 40,
                            height: 36,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <path d="M8 6V4h8v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <path d="M6 6l1 14h10l1-14" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                            <path d="M10 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <path d="M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </ContentWidth>

      {/* Receipt full-screen modal */}
      {receiptModalUrl ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setReceiptModalUrl(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.86)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 720,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(10,10,12,0.92)",
              padding: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 14, opacity: 0.9 }}>{receiptModalName}</div>
              <button
                type="button"
                onClick={() => setReceiptModalUrl(null)}
                style={{
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.9)",
                  borderRadius: 12,
                  padding: "8px 10px",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>

            <img
              src={receiptModalUrl}
              alt="Receipt full screen"
              style={{
                width: "100%",
                marginTop: 10,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(0,0,0,0.35)",
              }}
            />
          </div>
        </div>
      ) : null}

      <style>
        {`
          @media (max-width: 520px) {
            input.ll-date-input {
              width: 100% !important;
              max-width: 100% !important;
              min-width: 0 !important;
              box-sizing: border-box !important;
              display: block !important;
              border: 0 !important;
              background: transparent !important;
            }
          }
        `}
      </style>
    </PageShell>
  );
}
