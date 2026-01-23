// src/ui-kit/Button.tsx
import React from "react";
import { ui } from "./tokens";

type Variant = "primary" | "secondary" | "destructive";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export function Button({ variant = "secondary", style, ...props }: Props) {
  const base: React.CSSProperties = {
    borderRadius: 999,
    padding: "10px 16px",
    fontWeight: 800,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: ui.colors.text,
    cursor: "pointer",
  };

  const v: React.CSSProperties =
    variant === "primary"
      ? { background: ui.colors.accent, border: "none" }
      : variant === "destructive"
      ? { background: "transparent", border: `1px solid ${ui.colors.danger}`, color: ui.colors.danger }
      : {};

  return <button {...props} style={{ ...base, ...v, ...style }} />;
}
