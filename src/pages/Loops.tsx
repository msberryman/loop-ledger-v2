import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getLoops,
  getSettings,
  refreshAll,
  saveLoop,
  deleteLoop,
  updateLoopMileage,
} from "../lib/storage";

import { getDateRange, isWithinRange, type DateRangeKey } from "../lib/dateRange";
import "./Loops.css";

import { PageShell, ContentWidth, Card, Button as UiButton, PillRail } from "../ui-kit";

/* ---------------- Google helpers (same behavior, more reliable init) ---------------- */

let placesLoading: Promise<void> | null = null;

function ensurePlacesLoaded(): Promise<void> {
  const w = window as any;
  if (w.google?.maps?.places?.Autocomplete) return Promise.resolve();
  if (placesLoading) return placesLoading;

  const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return Promise.resolve();

  placesLoading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(
      'script[data-ll-places="1"]'
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Google Maps script failed to load"))
      );
      return;
    }

    const script = document.createElement("script");
    script.setAttribute("data-ll-places", "1");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps script failed to load"));
    document.head.appendChild(script);
  });

  return placesLoading;
}

async function waitForGoogle(timeoutMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const w = window as any;
    if (w.google?.maps?.DistanceMatrixService) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

async function computeRoundTripMilesFlexible(params: {
  homePlaceId?: string;
  homeAddress?: string;
  destPlaceId?: string;
  destAddress?: string;
}): Promise<number | null> {
  const ok = await waitForGoogle(2000);
  if (!ok) return null;

  const w = window as any;
  const service = new w.google.maps.DistanceMatrixService();

  const origin =
    params.homePlaceId
      ? ({ placeId: params.homePlaceId } as any)
      : (params.homeAddress || "").trim();

  const dest =
    params.destPlaceId
      ? ({ placeId: params.destPlaceId } as any)
      : (params.destAddress || "").trim();

  if (!origin || !dest) return null;

  return await new Promise((resolve) => {
    service.getDistanceMatrix(
      {
        origins: [origin],
        destinations: [dest],
        travelMode: w.google.maps.TravelMode.DRIVING,
        unitSystem: w.google.maps.UnitSystem.IMPERIAL,
      },
      (resp: any, status: string) => {
        try {
          if (status !== "OK") return resolve(null);
          const meters = resp?.rows?.[0]?.elements?.[0]?.distance?.value;
          if (!Number.isFinite(meters)) return resolve(null);
          const oneWayMiles = meters / 1609.344;
          resolve(oneWayMiles * 2);
        } catch {
          resolve(null);
        }
      }
    );
  });
}

/* ---------------- Types & helpers ---------------- */

type LoopType = "Single" | "Double" | "Forecaddie";

type Loop = {
  id: string;
  date: string; // "YYYY-MM-DD"
  course: string;
  placeId?: string;
  loopType: LoopType;

  bagFee: number;
  cashTip: number;
  digitalTip: number;
  preGrat: number;

  reportTime?: string; // "HH:MM"
  teeTime?: string; // "HH:MM"
  endTime?: string; // "HH:MM"

  mileage_miles?: number;
  mileage_cost?: number;
};

const uid = () => crypto.randomUUID?.() ?? String(Date.now() + Math.random());

function toNumber(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function sanitizeMoneyInput(s: string) {
  return s.replace(/[^\d.]/g, "");
}

/* ---------------- Page ---------------- */

export default function LoopsPage() {
  const [loops, setLoops] = useState<Loop[]>([]);
  const [settings, setSettings] = useState<any>(null);

  const [form, setForm] = useState<Loop>({
    id: "",
    date: "",
    course: "",
    placeId: "",
    loopType: "Single",
    bagFee: 0,
    cashTip: 0,
    digitalTip: 0,
    preGrat: 0,
    reportTime: "",
    teeTime: "",
    endTime: "",
    mileage_miles: 0,
    mileage_cost: 0,
  });

  const [bagFeeStr, setBagFeeStr] = useState("");
  const [bagFeeTouched, setBagFeeTouched] = useState(false);
  const [cashTipStr, setCashTipStr] = useState("");
  const [digitalTipStr, setDigitalTipStr] = useState("");
  const [preGratStr, setPreGratStr] = useState("");

  const inputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<any>(null);
  const placeListenerRef = useRef<any>(null);

  // Past Loops filter default: MTD
  const [rangeKey, setRangeKey] = useState<DateRangeKey>("MTD");

  // Past Loops: expandable/collapsible cards
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Colors match Income KPI dots
  const COLORS = {
    bag: "#F59E0B",
    cash: "#22C55E",
    digital: "#38BDF8",
    pre: "#A855F7",
  } as const;

  const shortCourseName = (s: string) => {
    const str = String(s || "").trim();
    if (!str) return "—";
    const first = str.split(",")[0]?.trim();
    return first || str;
  };

  const formatMMDDYYYY = (iso: string) => {
    const s = String(iso || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split("-");
      return `${m}-${d}-${y}`;
    }
    return s || "—";
  };

  const moneyShort = (v: number) => `$${Number(v || 0).toFixed(0)}`;

  const filteredLoops = useMemo(() => {
    const range = getDateRange(rangeKey);
    const inRange = (iso: string) => (rangeKey === "ALL" ? true : isWithinRange(iso, range));

    return (loops || [])
      .filter((l) => !l?.date || inRange(l.date))
      .slice()
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  }, [loops, rangeKey]);

  useEffect(() => {
    setLoops(getLoops() as any);
    setSettings(getSettings());

    refreshAll()
      .then(() => {
        setLoops(getLoops() as any);
        setSettings(getSettings());
        applyDefaultBagFee("Single");
      })
      .catch((e) => console.error("refreshAll failed:", e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Autocomplete (reliable init + cleanup)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const el = inputRef.current;
      if (!el) return;

      try {
        await ensurePlacesLoaded();
      } catch (e) {
        console.warn("Places load failed:", e);
        return;
      }
      if (cancelled) return;

      const w = window as any;
      const Autocomplete = w.google?.maps?.places?.Autocomplete;
      if (!Autocomplete) return;

      if (autocompleteRef.current) return;

      const ac = new Autocomplete(el, { fields: ["place_id", "name"] });
      autocompleteRef.current = ac;

      placeListenerRef.current = ac.addListener("place_changed", () => {
        const place = ac.getPlace?.();
        if (!place) return;

        setForm((prev) => ({
          ...prev,
          course: place.name || prev.course,
          placeId: place.place_id || prev.placeId,
        }));
      });
    })();

    return () => {
      cancelled = true;
      try {
        placeListenerRef.current?.remove?.();
      } catch {}
      placeListenerRef.current = null;
      autocompleteRef.current = null;
    };
  }, []);

  const update = (patch: Partial<Loop>) => setForm((p) => ({ ...p, ...patch }));

  const applyDefaultBagFee = (loopType: LoopType) => {
    if (bagFeeTouched) return;

    const s = getSettings();
    const defaults: Record<LoopType, any> = {
      Single: s?.defaultBagFeeSingle,
      Double: s?.defaultBagFeeDouble,
      Forecaddie: s?.defaultBagFeeForecaddie,
    };

    const v = defaults[loopType];
    if (v === null || v === undefined || v === "") return;

    setBagFeeStr(String(v));
  };

  const resetForm = () => {
    setForm({
      id: "",
      date: "",
      course: "",
      placeId: "",
      loopType: "Single",
      bagFee: 0,
      cashTip: 0,
      digitalTip: 0,
      preGrat: 0,
      reportTime: "",
      teeTime: "",
      endTime: "",
      mileage_miles: 0,
      mileage_cost: 0,
    });
    setBagFeeStr("");
    setBagFeeTouched(false);
    applyDefaultBagFee("Single");
    setCashTipStr("");
    setDigitalTipStr("");
    setPreGratStr("");
  };

  const onSave = async () => {
    if (!form.date || !form.course) return;

    const s = getSettings();
    const mileageRate = Number(s?.mileageRate ?? 0.67);

    let mileageMiles = Number(form.mileage_miles ?? 0);
    let mileageCost = Number(form.mileage_cost ?? 0);

    const homePlaceId = s?.homePlaceId || "";
    const homeAddress = s?.homeAddress || "";
    const destPlaceId = form.placeId || "";
    const destAddress = form.course || "";

    const computed = await computeRoundTripMilesFlexible({
      homePlaceId,
      homeAddress,
      destPlaceId,
      destAddress,
    });

    if (computed != null && Number.isFinite(computed)) {
      mileageMiles = computed;
      mileageCost = computed * mileageRate;
    }

    const loopToSave: Loop = {
      ...form,
      id: form.id || uid(),
      bagFee: toNumber(bagFeeStr || "0"),
      cashTip: toNumber(cashTipStr || "0"),
      digitalTip: toNumber(digitalTipStr || "0"),
      preGrat: toNumber(preGratStr || "0"),
      mileage_miles: mileageMiles,
      mileage_cost: mileageCost,
    };

    try {
      const saved = await saveLoop(loopToSave);
      await updateLoopMileage(saved.id, mileageMiles, mileageCost);

      await refreshAll();
      setLoops(getLoops() as any);
      setSettings(getSettings());

      resetForm();
    } catch (err) {
      console.error("Save loop failed:", err);
      alert("Failed to save loop. Please try again.");
    }
  };

  const onEdit = (l: Loop) => {
    setForm({
      ...l,
      reportTime: l.reportTime || "",
      teeTime: l.teeTime || "",
      endTime: l.endTime || "",
    });
    setBagFeeStr(l.bagFee ? String(l.bagFee) : "");
    setBagFeeTouched(true);
    setCashTipStr(l.cashTip ? String(l.cashTip) : "");
    setDigitalTipStr(l.digitalTip ? String(l.digitalTip) : "");
    setPreGratStr(l.preGrat ? String(l.preGrat) : "");
  };

  const onDelete = async (id: string) => {
    try {
      await deleteLoop(id);
      await refreshAll();
      setLoops(getLoops() as any);
      setSettings(getSettings());
    } catch (err) {
      console.error("Delete loop failed:", err);
      alert("Failed to delete loop. Please try again.");
    }
  };

  /* ---------------- Add Loop UI-only styles ---------------- */

  const fieldWrap: React.CSSProperties = {
    display: "grid",
    gap: 8,
    width: "100%",
    minWidth: 0,
  };

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

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: "auto",
  };

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

  const nativeInnerTime: React.CSSProperties = {
    ...nativeInner,
    padding: "10px 8px",
    textAlign: "center",
  };

  const moneyGrid: React.CSSProperties = {
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

  const moneyRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  };

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

  const timeGrid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
    width: "100%",
    alignItems: "start",
  };

  const timeLabelTwoLine: React.CSSProperties = {
    ...labelStyle,
    textAlign: "center",
    lineHeight: 1.05,
  };

  /* ---------------- Past Loops legend sizing (MATCH PILL RAIL WIDTH) ---------------- */

  // Same shrink-to-fit wrapper as the pill rail (so legend width == rail width)
  const railSizedWrap: React.CSSProperties = {
    display: "inline-block",
    width: "fit-content",
    maxWidth: "100%",
  };

  const railScaleWrap: React.CSSProperties = {
    ...railSizedWrap,
    transform: "scale(0.96)",
    transformOrigin: "center",
  };

  const legendRowStyle: React.CSSProperties = {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "nowrap",
    whiteSpace: "nowrap",
    fontSize: 12,
    opacity: 0.78,
    padding: "0 2px",
  };

  const legendItemStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    flex: "0 0 auto",
    whiteSpace: "nowrap",
  };

  return (
    <PageShell>
      <ContentWidth>
        <h1 className="ui-page-title" style={{ margin: 0 }}>
          Loops
        </h1>
      </ContentWidth>

      {/* ---------------- NEW ADD LOOP ---------------- */}
      <ContentWidth style={{ marginTop: 14 }}>
        <Card>
          <div style={{ fontSize: 12, letterSpacing: 1.4, opacity: 0.7 }}>ADD LOOP</div>

          <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
            {/* Date (native picker, clipped shell) */}
            <div style={fieldWrap}>
              <div style={labelStyle}>Date</div>
              <div style={nativeShell}>
                <input
                  className="ll-date-input"
                  type="date"
                  value={form.date || ""}
                  onChange={(e) => update({ date: e.target.value })}
                  style={nativeInner}
                />
              </div>
            </div>

            {/* Course (standard text input) */}
            <div style={fieldWrap}>
              <div style={labelStyle}>Course</div>
              <input
                ref={inputRef}
                type="text"
                value={form.course || ""}
                onChange={(e) => update({ course: e.target.value })}
                placeholder="Search course or place"
                style={inputStyle}
              />
            </div>

            {/* Caddie Type (standard select) */}
            <div style={fieldWrap}>
              <div style={labelStyle}>Caddie Type</div>
              <select
                value={form.loopType || "Single"}
                onChange={(e) => {
                  const nextType = e.target.value as LoopType;
                  update({ loopType: nextType });
                  applyDefaultBagFee(nextType);
                }}
                style={selectStyle}
              >
                <option value="Single">Single</option>
                <option value="Double">Double</option>
                <option value="Forecaddie">Forecaddie</option>
              </select>
            </div>

            {/* Money tiles */}
            <div style={moneyGrid}>
              <div style={moneyTile}>
                <div style={labelStyle}>Bag Fee</div>
                <div style={moneyRow}>
                  <span style={{ opacity: 0.75, fontWeight: 900 }}>$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={bagFeeStr}
                    placeholder="0"
                    onChange={(e) => {
                      setBagFeeTouched(true);
                      setBagFeeStr(sanitizeMoneyInput(e.target.value));
                    }}
                    style={moneyInput}
                  />
                </div>
              </div>

              <div style={moneyTile}>
                <div style={labelStyle}>Cash Tip</div>
                <div style={moneyRow}>
                  <span style={{ opacity: 0.75, fontWeight: 900 }}>$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={cashTipStr}
                    placeholder="0"
                    onChange={(e) => setCashTipStr(sanitizeMoneyInput(e.target.value))}
                    style={moneyInput}
                  />
                </div>
              </div>

              <div style={moneyTile}>
                <div style={labelStyle}>Digital Tip</div>
                <div style={moneyRow}>
                  <span style={{ opacity: 0.75, fontWeight: 900 }}>$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={digitalTipStr}
                    placeholder="0"
                    onChange={(e) => setDigitalTipStr(sanitizeMoneyInput(e.target.value))}
                    style={moneyInput}
                  />
                </div>
              </div>

              <div style={moneyTile}>
                <div style={labelStyle}>Pre-Grat</div>
                <div style={moneyRow}>
                  <span style={{ opacity: 0.75, fontWeight: 900 }}>$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={preGratStr}
                    placeholder="0"
                    onChange={(e) => setPreGratStr(sanitizeMoneyInput(e.target.value))}
                    style={moneyInput}
                  />
                </div>
              </div>
            </div>

            {/* Time grid (native pickers, clipped shells so each bubble is closed off) */}
            <div style={timeGrid}>
              <div style={{ ...fieldWrap, justifyItems: "stretch" }}>
                <div style={timeLabelTwoLine}>
                  REPORT<br />TIME
                </div>
                <div style={nativeShell}>
                  <input
                    className="ll-time-input"
                    type="time"
                    value={form.reportTime || ""}
                    onChange={(e) => update({ reportTime: e.target.value })}
                    style={nativeInnerTime}
                  />
                </div>
              </div>

              <div style={{ ...fieldWrap, justifyItems: "stretch" }}>
                <div style={timeLabelTwoLine}>
                  TEE<br />TIME
                </div>
                <div style={nativeShell}>
                  <input
                    className="ll-time-input"
                    type="time"
                    value={form.teeTime || ""}
                    onChange={(e) => update({ teeTime: e.target.value })}
                    style={nativeInnerTime}
                  />
                </div>
              </div>

              <div style={{ ...fieldWrap, justifyItems: "stretch" }}>
                <div style={timeLabelTwoLine}>
                  END<br />TIME
                </div>
                <div style={nativeShell}>
                  <input
                    className="ll-time-input"
                    type="time"
                    value={form.endTime || ""}
                    onChange={(e) => update({ endTime: e.target.value })}
                    style={nativeInnerTime}
                  />
                </div>
              </div>
            </div>

            <UiButton type="button" variant="primary" onClick={onSave} style={{ width: "100%" }}>
              Save Loop
            </UiButton>
          </div>
        </Card>
      </ContentWidth>

      {/* Divider */}
      <ContentWidth style={{ marginTop: 18 }}>
        <div
          style={{
            height: 1,
            background: "rgba(255,255,255,0.10)",
            width: "100%",
            margin: "6px 0 16px",
          }}
        />
      </ContentWidth>

      {/* ---------------- NEW PAST LOOPS ---------------- */}
      <ContentWidth>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>Past Loops</h2>

        {/* Range pills */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 12, marginBottom: 10 }}>
          <div style={railScaleWrap}>
            <PillRail<DateRangeKey>
              ariaLabel="Past loops date range filter"
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

        {/* Legend (now same exact width as pill rail; forced single line on mobile) */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <div style={railScaleWrap}>
            <div className="ll-legend" style={legendRowStyle}>
              <div className="ll-legend-item" style={legendItemStyle}>
                <span className="ui-color-dot" style={{ backgroundColor: COLORS.bag }} />
                <span>Bag Fee</span>
              </div>
              <div className="ll-legend-item" style={legendItemStyle}>
                <span className="ui-color-dot" style={{ backgroundColor: COLORS.cash }} />
                <span>Cash Tip</span>
              </div>
              <div className="ll-legend-item" style={legendItemStyle}>
                <span className="ui-color-dot" style={{ backgroundColor: COLORS.digital }} />
                <span>Digital Tip</span>
              </div>
              <div className="ll-legend-item" style={legendItemStyle}>
                <span className="ui-color-dot" style={{ backgroundColor: COLORS.pre }} />
                <span>Pre-Grat</span>
              </div>
            </div>
          </div>
        </div>

        {filteredLoops.length === 0 ? (
          <div style={{ opacity: 0.7, textAlign: "center" }}>No loops in this range.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {filteredLoops.map((l) => {
              const bag = toNumber(String(l.bagFee));
              const cash = toNumber(String(l.cashTip));
              const digital = toNumber(String(l.digitalTip));
              const pre = toNumber(String(l.preGrat));
              const total = bag + cash + digital + pre;

              const isOpen = expandedIds.has(l.id);

              return (
                <Card key={l.id}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div style={{ fontWeight: 900, fontSize: 16, lineHeight: 1.25 }}>
                      {shortCourseName(l.course)}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ fontWeight: 900, fontSize: 16, whiteSpace: "nowrap" }}>
                        ${total.toFixed(2)}
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleExpanded(l.id)}
                        aria-label={isOpen ? "Collapse loop details" : "Expand loop details"}
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
                    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>
                        {formatMMDDYYYY(l.date)} • {l.loopType || "—"}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 14,
                          flexWrap: "wrap",
                          alignItems: "center",
                          fontSize: 12,
                          opacity: 0.9,
                        }}
                      >
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <span className="ui-color-dot" style={{ backgroundColor: COLORS.bag }} />
                          <span>{moneyShort(bag)}</span>
                        </div>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <span className="ui-color-dot" style={{ backgroundColor: COLORS.cash }} />
                          <span>{moneyShort(cash)}</span>
                        </div>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <span className="ui-color-dot" style={{ backgroundColor: COLORS.digital }} />
                          <span>{moneyShort(digital)}</span>
                        </div>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <span className="ui-color-dot" style={{ backgroundColor: COLORS.pre }} />
                          <span>{moneyShort(pre)}</span>
                        </div>
                      </div>

                      <div style={{ fontSize: 12, opacity: 0.75 }}>
                        Mileage cost: ${toNumber(String(l.mileage_cost ?? 0)).toFixed(2)}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: 10,
                          marginTop: 2,
                        }}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(l);
                          }}
                          aria-label="Edit loop"
                          title="Edit"
                          style={{
                            border: "1px solid rgba(255,255,255,0.14)",
                            background: "rgba(255,255,255,0.06)",
                            color: "rgba(255,255,255,0.9)",
                            borderRadius: 12,
                            width: 36,
                            height: 36,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path
                              d="M12 20h9"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                            <path
                              d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(l.id);
                          }}
                          aria-label="Delete loop"
                          title="Delete"
                          style={{
                            border: "1px solid rgba(239,68,68,0.7)",
                            background: "transparent",
                            color: "rgba(239,68,68,0.95)",
                            borderRadius: 12,
                            width: 36,
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
                            <path
                              d="M6 6l1 14h10l1-14"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinejoin="round"
                            />
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

      {/* iOS/Safari hardening: ensure inputs never reintroduce borders/backgrounds that fight the shell */}
      <style>
        {`
          @media (max-width: 520px) {
            input.ll-date-input,
            input.ll-time-input {
              width: 100% !important;
              max-width: 100% !important;
              min-width: 0 !important;
              box-sizing: border-box !important;
              display: block !important;
              border: 0 !important;
              background: transparent !important;
            }

            /* Legend: force single line + slightly tighter so it fits without wrapping */
            .ll-legend {
              font-size: 11px !important;
              gap: 10px !important;
              white-space: nowrap !important;
              flex-wrap: nowrap !important;
            }
            .ll-legend-item {
              gap: 6px !important;
              white-space: nowrap !important;
            }
          }
        `}
      </style>
    </PageShell>
  );
}
