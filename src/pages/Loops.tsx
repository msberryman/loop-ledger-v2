import React, { useEffect, useMemo, useRef, useState } from "react";
import { getLoops, saveLoops, getSettings } from "../lib/storage";

import DateRangeChips from "../components/DateRangeChips";
import { getDateRange, isWithinRange, type DateRangeKey } from "../lib/dateRange";
import "./Loops.css";

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

/**
 * NOTE on time inputs:
 * HTML <input type="time"> does NOT reliably show placeholder text inside the box.
 * To get the "gray title in the box" behavior you asked for, we use type="text" with placeholders.
 * (We still store "HH:MM" exactly the same.)
 */
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
const [cashTipStr, setCashTipStr] = useState("");
const [digitalTipStr, setDigitalTipStr] = useState("");
const [preGratStr, setPreGratStr] = useState("");


  const inputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<any>(null);

  // Filters: date range chips (default 7D)
  const [rangeKey, setRangeKey] = useState<DateRangeKey>("7D");

  // Derived list: filtered by range + sorted newest → oldest
  const filteredLoops = useMemo(() => {
    const range = getDateRange(rangeKey);
    const inRange = (iso: string) =>
      rangeKey === "ALL" ? true : isWithinRange(iso, range);

    return (loops || [])
      .filter((l) => !l?.date || inRange(l.date))
      .slice()
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  }, [loops, rangeKey]);

  useEffect(() => {
    setLoops(getLoops() || []);
    setSettings(getSettings() || null);
  }, []);

  // Initialize Google Places Autocomplete (course input)
  useEffect(() => {
    if (!inputRef.current) return;

    const tryInit = () => {
      if (!window.google?.maps?.places) return false;

      // If already initialized, don't re-init
      if (autocompleteRef.current) return true;

      autocompleteRef.current = new window.google.maps.places.Autocomplete(
        inputRef.current,
        {
          types: ["establishment"],
          fields: ["place_id", "name"],
        }
      );

      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current.getPlace();
        if (!place) return;

        setForm((prev) => ({
          ...prev,
          course: place.name || prev.course,
          placeId: place.place_id || prev.placeId,
        }));
      });

      return true;
    };

    // attempt immediately
    if (tryInit()) return;

    // otherwise retry briefly
    const t = setInterval(() => {
      if (tryInit()) clearInterval(t);
    }, 250);

    return () => clearInterval(t);
  }, []);

  const update = (patch: Partial<Loop>) => setForm((p) => ({ ...p, ...patch }));

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
  setCashTipStr("");
  setDigitalTipStr("");
  setPreGratStr("");
  };

  const onSave = async () => {
  // Basic validation
  if (!form.date || !form.course) return;

  const settings = getSettings();
  const mileageRate = Number(settings?.mileageRate ?? 0.67);

  // Default to existing values (important for edits)
  let mileageMiles = Number(form.mileage_miles ?? 0);
  let mileageCost = Number(form.mileage_cost ?? 0);

  // If we have both place IDs, compute fresh round-trip mileage
  const homePlaceId = settings?.homePlaceId || "";
const homeAddress = settings?.homeAddress || "";
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

  const next = form.id
    ? (loops || []).map((l) => (l.id === form.id ? loopToSave : l))
    : [loopToSave, ...(loops || [])];

  setLoops(next);
  saveLoops(next);

  resetForm();
};


  const onEdit = (l: Loop) => {
    setForm({
      ...l,
      reportTime: l.reportTime || "",
      teeTime: l.teeTime || "",
      endTime: l.endTime || "",
    });
  setBagFeeStr(l.bagFee ? String(l.bagFee) : "");
  setCashTipStr(l.cashTip ? String(l.cashTip) : "");
  setDigitalTipStr(l.digitalTip ? String(l.digitalTip) : "");
  setPreGratStr(l.preGrat ? String(l.preGrat) : "");
  };

  const onDelete = (id: string) => {
    const next = (loops || []).filter((l) => l.id !== id);
    setLoops(next);
    saveLoops(next);
  };

    return (
    <div className="ll-page">
      <h1 className="ll-title">Add Loop</h1>

      {/* ===== Add Loop Form ===== */}
      <div className="ll-form">
        <div className="ll-panel">
          <div className="ll-stack">
            {/* Date */}
            <div className="ll-field">
              <div className="ll-label">Date</div>
              <input
                type="date"
                value={form.date || ""}
                onChange={(e) => update({ date: e.target.value })}
                className="ll-input"
              />
            </div>

            {/* Course */}
            <div className="ll-field">
              <div className="ll-label">Course</div>
              <input
                ref={inputRef}
                type="text"
                value={form.course || ""}
                onChange={(e) => update({ course: e.target.value })}
                placeholder="Search course or place"
                className="ll-input"
              />
            </div>

            {/* Loop Type */}
            <div className="ll-field">
              <div className="ll-label">Caddie Type</div>
              <select
                value={form.loopType || "Single"}
                onChange={(e) => update({ loopType: e.target.value as any })}
                className="ll-select"
              >
                <option value="Single">Single</option>
                <option value="Double">Double</option>
                <option value="Forecaddie">Forecaddie</option>
              </select>
            </div>

                  {/* Money Grid */}
      <div className="ll-gridMoney">
        {/* Bag Fee */}
        <div className="ll-moneyTile">
          <div className="ll-label">Bag Fee</div>
          <div className="ll-moneyRow">
            <span className="ll-moneySymbol">$</span>
            <input
              type="text"
              inputMode="decimal"
              className="ll-moneyInput"
              value={bagFeeStr}
              placeholder="0"
              onChange={(e) => setBagFeeStr(sanitizeMoneyInput(e.target.value))}
            />
          </div>
        </div>

        {/* Cash Tip */}
        <div className="ll-moneyTile">
          <div className="ll-label">Cash Tip</div>
          <div className="ll-moneyRow">
            <span className="ll-moneySymbol">$</span>
            <input
              type="text"
              inputMode="decimal"
              className="ll-moneyInput"
              value={cashTipStr}
              placeholder="0"
              onChange={(e) => setCashTipStr(sanitizeMoneyInput(e.target.value))}
            />
          </div>
        </div>

        {/* Digital Tip */}
        <div className="ll-moneyTile">
          <div className="ll-label">Digital Tip</div>
          <div className="ll-moneyRow">
            <span className="ll-moneySymbol">$</span>
            <input
              type="text"
              inputMode="decimal"
              className="ll-moneyInput"
              value={digitalTipStr}
              placeholder="0"
              onChange={(e) => setDigitalTipStr(sanitizeMoneyInput(e.target.value))}
            />
          </div>
        </div>

        {/* Pre-Grat */}
        <div className="ll-moneyTile">
          <div className="ll-label">Pre-Grat</div>
          <div className="ll-moneyRow">
            <span className="ll-moneySymbol">$</span>
            <input
              type="text"
              inputMode="decimal"
              className="ll-moneyInput"
              value={preGratStr}
              placeholder="0"
              onChange={(e) => setPreGratStr(sanitizeMoneyInput(e.target.value))}
            />
          </div>
        </div>
      </div>


            {/* Time Grid */}
            <div className="ll-gridTime">
              <div className="ll-field">
                <div className="ll-label">Report Time</div>
                <input
                  type="time"
                  value={form.reportTime || ""}
                  onChange={(e) => update({ reportTime: e.target.value })}
                  className="ll-input"
                />
              </div>

              <div className="ll-field">
                <div className="ll-label">Tee Time</div>
                <input
                  type="time"
                  value={form.teeTime || ""}
                  onChange={(e) => update({ teeTime: e.target.value })}
                  className="ll-input"
                />
              </div>

              <div className="ll-field">
                <div className="ll-label">End Time</div>
                <input
                  type="time"
                  value={form.endTime || ""}
                  onChange={(e) => update({ endTime: e.target.value })}
                  className="ll-input"
                />
              </div>
            </div>

            <button className="ll-btn ll-btnPrimary" onClick={onSave}>
              Save Loop
            </button>
          </div>
        </div>
      </div>

      {/* ===== Past Loops ===== */}
      <h2 className="ll-sectionTitle">Past Loops</h2>

      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
        <DateRangeChips value={rangeKey} onChange={setRangeKey} />
      </div>

      {filteredLoops.length === 0 ? (
        <div style={{ opacity: 0.7, textAlign: "center" }}>No loops in this range.</div>
      ) : (
        <div className="ll-list">
          {filteredLoops.map((l) => (
            <div key={l.id} className="ll-card">
              <div className="ll-loopCardHeader">
                <div>
                  <div className="ll-loopTitle">
                    {l.date} — {l.course}
                  </div>
                  <div className="ll-loopMeta">
                    Bag Fee: ${toNumber(String(l.bagFee)).toFixed(0)} | Cash: $
                    {toNumber(String(l.cashTip)).toFixed(0)} | Digital: $
                    {toNumber(String(l.digitalTip)).toFixed(0)}
                    <br />
                    Pre-Grat: ${toNumber(String(l.preGrat)).toFixed(0)}
                    <br />
                    Mileage Cost: ${toNumber(String(l.mileage_cost ?? 0)).toFixed(2)}
                  </div>
                </div>

                <div className="ll-actions">
                  <button onClick={() => onEdit(l)} className="ll-btn ll-btnGhost">
                    Edit
                  </button>
                  <button onClick={() => onDelete(l.id)} className="ll-btn ll-btnDanger">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

