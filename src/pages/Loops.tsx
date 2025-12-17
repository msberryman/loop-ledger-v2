import React, { useEffect, useState, useRef } from "react";
import { getLoops, saveLoops } from "../lib/storage";
import { getSettings } from "../lib/storage";

const IRS_MILEAGE_RATE = 0.67;

export default function LoopsPage() {
  const [loops, setLoops] = useState(getLoops());
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    date: "",
    course: "",
    placeId: "",
    loopType: "Single",
    bagFee: "",
    cashTip: "",
    digitalTip: "",
    preGrat: "",
    reportTime: "",
    teeTime: "",
    endTime: "",
  });

  // -------------------------
  // UPDATE FIELD HELPERS
  // -------------------------
  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // -------------------------
// -------------------------
// GOOGLE AUTOCOMPLETE (OPTION B - ANY ADDRESS)
// -------------------------
const courseInputRef = useRef(null);

useEffect(() => {
  // If Google already loaded, init immediately
  if (window.google && window.google.maps && window.google.maps.places) {
    initAutocomplete();
    return;
  }

  // Inject Google Maps script
  const script = document.createElement("script");
  script.src =
    "https://maps.googleapis.com/maps/api/js?key=AIzaSyBeDj7to68qtoV6_c0tO0TsmO02nSoUr34&libraries=places";
  script.async = true;
  script.onload = () => initAutocomplete();
  document.head.appendChild(script);
}, []);

function initAutocomplete() {
  const input = courseInputRef.current;
  if (!input || !window.google || !google.maps.places) return;

  const autocomplete = new google.maps.places.Autocomplete(input, {
    types: ["geocode"], // Allow ANY location
    fields: ["formatted_address", "place_id", "name"], // ALWAYS includes place_id
  });

  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();
    if (!place) return;

    // Pick the best possible display name
    const displayName =
      place.name ||
      place.formatted_address ||
      input.value;

    updateField("course", displayName);
    updateField("placeId", place.place_id);
  });
}

  // -------------------------
  // MILEAGE CALCULATION
  // -------------------------
  async function calculateMileage(destinationPlaceId) {
    const settings = getSettings();
    if (!settings?.homePlaceId || !destinationPlaceId)
      return { miles: 0, cost: 0 };

    try {
      const service = new google.maps.DistanceMatrixService();

      const res = await service.getDistanceMatrix({
        origins: [{ placeId: settings.homePlaceId }],
        destinations: [{ placeId: destinationPlaceId }],
        travelMode: google.maps.TravelMode.DRIVING,
      });

      const meters = res.rows?.[0]?.elements?.[0]?.distance?.value ?? 0;

      const oneWayMiles = meters / 1609.34;
      const roundTripMiles = oneWayMiles * 2;

      const cost = roundTripMiles * IRS_MILEAGE_RATE;

      return {
        miles: Number(roundTripMiles.toFixed(2)),
        cost: Number(cost.toFixed(2)),
      };
    } catch (err) {
      console.error("Mileage error:", err);
      return { miles: 0, cost: 0 };
    }
  }

  // -------------------------
  // SAVE LOOP
  // -------------------------
  async function handleSave() {
    if (!form.date || !form.course || !form.placeId) {
      alert("Date, course, and course selection required.");
      return;
    }

    // get mileage BEFORE saving
console.log("PLACE ID BEING SAVED:", form.placeId);
    const mileage = await calculateMileage(form.placeId);

    const newLoop = {
      id: editingId ?? Date.now(),
      ...form,
      bagFee: Number(form.bagFee || 0),
      cashTip: Number(form.cashTip || 0),
      digitalTip: Number(form.digitalTip || 0),
      preGrat: Number(form.preGrat || 0),
      mileage_miles: mileage.miles,
      mileage_cost: mileage.cost,
    };

    let updated;
    if (editingId) {
      updated = loops.map((l) => (l.id === editingId ? newLoop : l));
    } else {
      updated = [...loops, newLoop];
    }

    saveLoops(updated);
    setLoops(updated);

    // reset
    setEditingId(null);
    setForm({
      date: "",
      course: "",
      placeId: "",
      loopType: "Single",
      bagFee: "",
      cashTip: "",
      digitalTip: "",
      preGrat: "",
      reportTime: "",
      teeTime: "",
      endTime: "",
    });
  }

  // -------------------------
  // DELETE LOOP
  // -------------------------
  function handleDelete(id) {
    const updated = loops.filter((l) => l.id !== id);
    saveLoops(updated);
    setLoops(updated);
  }

  // -------------------------
  // EDIT LOOP
  // -------------------------
  function handleEdit(loop) {
    setEditingId(loop.id);
    setForm({ ...loop });
  }

  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ textAlign: "center" }}>Add Loop</h2>

      <input
        type="date"
        value={form.date}
        onChange={(e) => updateField("date", e.target.value)}
        style={{ width: "100%", marginBottom: 12 }}
      />

      {/* GOOGLE AUTOCOMPLETE INPUT */}
      <input
  ref={courseInputRef}
  value={form.course}
  placeholder="Search course or address"
  onChange={(e) => updateField("course", e.target.value)}
  style={{ width: "100%", marginBottom: 12 }}
/>


      <select
        value={form.loopType}
        onChange={(e) => updateField("loopType", e.target.value)}
        style={{ width: "100%", marginBottom: 12 }}
      >
        <option>Single</option>
        <option>Double</option>
        <option>Forecaddie</option>
      </select>

      <input
        value={form.bagFee}
        placeholder="Bag Fee"
        onChange={(e) => updateField("bagFee", e.target.value)}
        style={{ width: "100%", marginBottom: 12 }}
      />
      <input
        value={form.cashTip}
        placeholder="Cash Tip"
        onChange={(e) => updateField("cashTip", e.target.value)}
        style={{ width: "100%", marginBottom: 12 }}
      />
      <input
        value={form.digitalTip}
        placeholder="Digital Tip"
        onChange={(e) => updateField("digitalTip", e.target.value)}
        style={{ width: "100%", marginBottom: 12 }}
      />
      <input
        value={form.preGrat}
        placeholder="Pre-Grat"
        onChange={(e) => updateField("preGrat", e.target.value)}
        style={{ width: "100%", marginBottom: 12 }}
      />

      <input
        type="time"
        value={form.reportTime}
        onChange={(e) => updateField("reportTime", e.target.value)}
        style={{ width: "100%", marginBottom: 12 }}
      />
      <input
        type="time"
        value={form.teeTime}
        onChange={(e) => updateField("teeTime", e.target.value)}
        style={{ width: "100%", marginBottom: 12 }}
      />
      <input
        type="time"
        value={form.endTime}
        onChange={(e) => updateField("endTime", e.target.value)}
        style={{ width: "100%", marginBottom: 12 }}
      />

      <button
        onClick={handleSave}
        style={{
          width: "100%",
          padding: 12,
          background: "#007aff",
          color: "white",
          border: "none",
          borderRadius: 6,
          marginBottom: 30,
        }}
      >
        Save Loop
      </button>

      <h3 style={{ textAlign: "center" }}>Past Loops</h3>

      {loops.length === 0 && (
        <p style={{ textAlign: "center" }}>No loops logged yet.</p>
      )}

      {loops.map((loop) => (
        <div
          key={loop.id}
          style={{
            padding: 12,
            border: "1px solid #444",
            borderRadius: 6,
            marginBottom: 16,
            background: "#111",
          }}
        >
          <strong>{loop.date}</strong> — {loop.course}
          <br />
          Bag Fee: ${loop.bagFee} | Cash: ${loop.cashTip} | Digital: $
          {loop.digitalTip}
          <br />
          Pre-Grat: ${loop.preGrat}
          <br />
          Mileage Cost: ${loop.mileage_cost.toFixed(2)}
          <br />
          <button
            onClick={() => handleEdit(loop)}
            style={{
              marginTop: 8,
              marginRight: 10,
              padding: "6px 10px",
              background: "#007aff",
              color: "white",
              border: "none",
              borderRadius: 4,
            }}
          >
            Edit
          </button>
          <button
            onClick={() => handleDelete(loop.id)}
            style={{
              marginTop: 8,
              padding: "6px 10px",
              background: "#ff3b30",
              color: "white",
              border: "none",
              borderRadius: 4,
            }}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}

