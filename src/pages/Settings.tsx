// src/pages/Settings.tsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getSettings, refreshAll, saveSettings } from "../lib/storage";
import { Card } from "../ui/card";
import { Button } from "../ui/Button";

/**
 * Settings
 * - Save home address (with Google Places) into "ll_user_settings"
 * - Log out of Supabase and clear local settings
 */

// --- Google Places loader + autocomplete (for home address) ---
let placesLoading: Promise<void> | null = null;
function ensurePlacesLoaded(): Promise<void> {
  if ((window as any).google?.maps?.places?.Autocomplete) return Promise.resolve();
  if (placesLoading) return placesLoading;

  const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return Promise.resolve();

  placesLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return placesLoading;
}

function usePlacesAutocomplete(
  inputRef: React.RefObject<HTMLInputElement>,
  onPick: (text: string, placeId?: string) => void
) {
  useEffect(() => {
    let ac: any = null;
    let listener: any = null;
    let cancelled = false;

    ensurePlacesLoaded().then(() => {
      if (cancelled) return;

      const el = inputRef.current;
      const g = (window as any).google;
      if (!el || !g?.maps?.places?.Autocomplete) return;

      ac = new g.maps.places.Autocomplete(el, {
        types: ["geocode"],
        fields: ["formatted_address", "place_id"],
      });

      listener = ac.addListener("place_changed", () => {
        const place = ac.getPlace?.();
        const addr =
          place?.formatted_address || (el as HTMLInputElement).value || "";
        onPick(addr, place?.place_id);
      });
    });

    return () => {
      cancelled = true;
      if (listener) listener.remove?.();
    };
  }, [inputRef, onPick]);
}

export default function Settings() {
  const navigate = useNavigate();
  const [address, setAddress] = useState("");
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [mileageRate, setMileageRate] = useState("0.67");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [defaultBagFeeSingle, setDefaultBagFeeSingle] = useState("");
  const [defaultBagFeeDouble, setDefaultBagFeeDouble] = useState("");
  const [defaultBagFeeForecaddie, setDefaultBagFeeForecaddie] = useState("");


// Load settings from Supabase (via storage cache)
useEffect(() => {
  let cancelled = false;

  (async () => {
    try {
      await refreshAll(); // pulls ll_user_settings into cache
      const s = getSettings();

      if (cancelled) return;

      setAddress(s?.homeAddress || "");
      setPlaceId(s?.homePlaceId || null);
      setMileageRate(String(s?.mileageRate ?? "0.67"));
      setDefaultBagFeeSingle(s?.defaultBagFeeSingle != null ? String(s.defaultBagFeeSingle) : "");
      setDefaultBagFeeDouble(s?.defaultBagFeeDouble != null ? String(s.defaultBagFeeDouble) : "");
      setDefaultBagFeeForecaddie(s?.defaultBagFeeForecaddie != null ? String(s.defaultBagFeeForecaddie) : "");
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      if (!cancelled) setLoading(false);
    }
  })();

  return () => {
    cancelled = true;
  };
}, []);


  // Wire up autocomplete to update address + placeId
  usePlacesAutocomplete(inputRef, (text, pid) => {
  setAddress(text);
  setPlaceId(pid ?? null);
  setAddressError(null);
});

  async function handleSave() {
  if (!address || !placeId) {
    setAddressError(
      "Please select a full address from the suggestions list."
    );
    return;
  }

  setSaving(true);
  try {
    await saveSettings({
      homeAddress: address,
      homePlaceId: placeId,
      mileageRate: mileageRate,
      defaultBagFeeSingle: defaultBagFeeSingle === "" ? null : Number(defaultBagFeeSingle),
      defaultBagFeeDouble: defaultBagFeeDouble === "" ? null : Number(defaultBagFeeDouble),
      defaultBagFeeForecaddie: defaultBagFeeForecaddie === "" ? null : Number(defaultBagFeeForecaddie),
    });

    await refreshAll();
    navigate("/home", { replace: true });
  } catch (err) {
    console.error("Save settings failed:", err);
    alert("Failed to save settings. Please try again.");
  } finally {
    setSaving(false);
  }
}

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Sign out failed", err);
    } finally {
  navigate("/login", { replace: true });
}
  }

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
            Settings
          </h1>
          <p style={{ margin: 0, opacity: 0.7, fontSize: 14 }}>
            Tune mileage and account details for your ledger.
          </p>
        </div>

        {/* Account actions */}
        <Button variant="ghost" onClick={handleLogout}>
          Log Out
        </Button>
      </div>

      <div
        style={{
          display: "grid",
          gap: 16,
          maxWidth: 640,
        }}
      >
        <Card>
          <div
            style={{
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                Home address
              </div>
              <div style={{ fontSize: 13, opacity: 0.7 }}>
                Used to calculate round-trip mileage for each loop.
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                ref={inputRef}
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Start typing and pick from suggestions…"
                disabled={loading}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #232931",
                  background: "transparent",
                  color: "inherit",
                  outline: "none",
                }}
              />

{addressError && (
  <div style={{ color: "#ff6b6b", fontSize: 13 }}>
    {addressError}
  </div>
)}

<div style={{ display: "grid", gap: 10, marginTop: 10 }}>
  <div style={{ fontSize: 14, fontWeight: 600 }}>Default bag fees</div>

  <div style={{ display: "grid", gap: 6 }}>
    <label style={{ fontSize: 12, opacity: 0.8 }}>Single Bag</label>
    <input
      type="text"
      inputMode="decimal"
      value={defaultBagFeeSingle}
      onChange={(e) => setDefaultBagFeeSingle(e.target.value.replace(/[^\d.]/g, ""))}
      placeholder="e.g., $60"
      disabled={loading}
      style={{
        display: "block",
        width: "100%",
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid #232931",
        background: "transparent",
        color: "inherit",
        outline: "none",
      }}
    />
  </div>

  <div style={{ display: "grid", gap: 6 }}>
    <label style={{ fontSize: 12, opacity: 0.8 }}>Double Bag</label>
    <input
      type="text"
      inputMode="decimal"
      value={defaultBagFeeDouble}
      onChange={(e) => setDefaultBagFeeDouble(e.target.value.replace(/[^\d.]/g, ""))}
      placeholder="e.g., $80"
      disabled={loading}
      style={{
        display: "block",
        width: "100%",
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid #232931",
        background: "transparent",
        color: "inherit",
        outline: "none",
      }}
    />
  </div>

  <div style={{ display: "grid", gap: 6 }}>
    <label style={{ fontSize: 12, opacity: 0.8 }}>Forecaddie</label>
    <input
      type="text"
      inputMode="decimal"
      value={defaultBagFeeForecaddie}
      onChange={(e) => setDefaultBagFeeForecaddie(e.target.value.replace(/[^\d.]/g, ""))}
      placeholder="e.g., $40"
      disabled={loading}
      style={{
        display: "block",
        width: "100%",
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid #232931",
        background: "transparent",
        color: "inherit",
        outline: "none",
      }}
    />
  </div>

  <div style={{ fontSize: 12, opacity: 0.7 }}>
    Leave blank if you don’t want a default.
  </div>
</div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || loading}
                >
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}


