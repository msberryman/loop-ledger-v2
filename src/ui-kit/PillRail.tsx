// src/ui-kit/PillRail.tsx
import React from "react";

export type PillOption<T extends string> = {
  key: T;
  label: string;
};

type PillRailProps<T extends string> = {
  ariaLabel: string;
  options: PillOption<T>[];
  value: T;
  onChange: (next: T) => void;
};

/**
 * PillRail: standardized filter rail (Income/Insights).
 * UI-only. Controlled by parent state.
 */
export function PillRail<T extends string>({ ariaLabel, options, value, onChange }: PillRailProps<T>) {
  return (
    <div className="ui-pill-rail" role="tablist" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          className={`ui-pill ${value === o.key ? "is-active" : ""}`}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
