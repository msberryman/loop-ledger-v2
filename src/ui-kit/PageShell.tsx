// src/ui-kit/PageShell.tsx
import React from "react";
import { ui } from "./tokens";

type PageShellProps = {
  children: React.ReactNode;
  style?: React.CSSProperties;
};

/**
 * PageShell enforces the Income/Insights page padding + base text color.
 * UI-only wrapper. No logic.
 */
export function PageShell({ children, style }: PageShellProps) {
  return (
    <div
      style={{
        padding: ui.page.padding,
        color: ui.page.textColor,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
