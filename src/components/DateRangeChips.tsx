import React from "react";
import type { DateRangeKey } from "../lib/dateRange";

const KEYS: DateRangeKey[] = ["7D", "14D", "30D", "MTD", "YTD", "ALL"];

export default function DateRangeChips({
  value,
  onChange,
}: {
  value: DateRangeKey;
  onChange: (v: DateRangeKey) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
      {KEYS.map((k) => {
        const active = k === value;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.12)",
              background: active ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.06)",
              color: "white",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
            aria-pressed={active}
          >
            {k}
          </button>
        );
      })}
    </div>
  );
}
