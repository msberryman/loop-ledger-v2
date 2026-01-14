// src/pages/Settings.tsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
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

  // Load existing settings from localStorage
  useEffect(() => {
  try {
    const raw = localStorage.getItem("ll_user_settings");
    if (raw) {
      const s = JSON.parse(raw);
      setAddress(s.home_address || "");
      setPlaceId(s.home_place_id ?? null);
      setMileageRate(String(s.mileage_rate ?? "0.67"));
    }
  } catch {
    // no-op
  } finally {
    setLoading(false);
  }
}, []);


  // Wire up autocomplete to update address + placeId
  usePlacesAutocomplete(inputRef, (text, pid) => {
    setAddress(text);
    setPlaceId(pid ?? null);
  });

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
  home_address: address,
  home_place_id: placeId,
  mileage_rate: mileageRate,
};
      localStorage.setItem("ll_user_settings", JSON.stringify(payload));
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
      localStorage.removeItem("ll_user_settings");
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


