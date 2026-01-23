// src/pages/Settings.tsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getSettings, refreshAll, saveSettings } from "../lib/storage";

import { PageShell, PageHeader, ContentWidth, Card, Button } from "../ui-kit";

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
        const addr = place?.formatted_address || (el as HTMLInputElement).value || "";
        onPick(addr, place?.place_id);
      });
    });

    return () => {
      cancelled = true;
      if (listener) listener.remove?.();
    };
  }, [inputRef, onPick]);
}

/** UI-only helpers for currency display in input fields */
function formatCurrencyInput(rawNumeric: string): string {
  if (!rawNumeric) return "";
  return `$${rawNumeric}`;
}

function stripToNumeric(val: string): string {
  // allow digits + one dot
  const cleaned = val.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
}

export default function Settings() {
  const navigate = useNavigate();

  const [address, setAddress] = useState("");
  const [placeId, setPlaceId] = useState<string | null>(null);

  // Keep as-is (even if not shown in UI right now)
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
        setDefaultBagFeeForecaddie(
          s?.defaultBagFeeForecaddie != null ? String(s.defaultBagFeeForecaddie) : ""
        );
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
      setAddressError("Please select a full address from the suggestions list.");
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

  // Shared input style to match the calm, premium “soft field” vibe
  const inputStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    boxSizing: "border-box", // ✅ fixes "wider than card" issue
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.04)",
    color: "inherit",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    opacity: 0.75,
  };

  return (
    <PageShell>
      <ContentWidth>
        <PageHeader
          title="Settings"
          subtitle="Tune mileage and account details for your ledger."
          right={
            <div style={{ alignSelf: "flex-start" }}>
              <Button
                type="button"
                variant="secondary"
                onClick={handleLogout}
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.14)",
                  padding: "10px 14px",
                  marginTop: 6, // ✅ prevents the “floating” feel on mobile stack
                }}
              >
                Log Out
              </Button>
            </div>
          }
        />
      </ContentWidth>

      <ContentWidth style={{ marginTop: 14 }}>
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Home address section */}
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Home Address</div>
              <div style={{ fontSize: 13, opacity: 0.7 }}>
                Used to calculate round-trip mileage for each loop.
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                ref={inputRef}
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Start typing and pick from suggestions…"
                disabled={loading}
                style={inputStyle}
              />

              {addressError && (
                <div style={{ color: "#ff6b6b", fontSize: 13 }}>{addressError}</div>
              )}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.10)" }} />

            {/* Default bag fees section */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>Default Bag Fees</div>
              <div style={{ fontSize: 13, opacity: 0.7 }}>
                Leave blank if you don’t want a default.
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginTop: 6 }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={labelStyle}>Single Bag</div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formatCurrencyInput(defaultBagFeeSingle)}
                    onChange={(e) => setDefaultBagFeeSingle(stripToNumeric(e.target.value))}
                    placeholder="e.g., $60"
                    disabled={loading}
                    style={inputStyle}
                  />
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <div style={labelStyle}>Double Bag</div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formatCurrencyInput(defaultBagFeeDouble)}
                    onChange={(e) => setDefaultBagFeeDouble(stripToNumeric(e.target.value))}
                    placeholder="e.g., $80"
                    disabled={loading}
                    style={inputStyle}
                  />
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <div style={labelStyle}>Forecaddie</div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formatCurrencyInput(defaultBagFeeForecaddie)}
                    onChange={(e) => setDefaultBagFeeForecaddie(stripToNumeric(e.target.value))}
                    placeholder="e.g., $40"
                    disabled={loading}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Save button */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleSave}
                  disabled={saving || loading}
                >
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </ContentWidth>
    </PageShell>
  );
}
