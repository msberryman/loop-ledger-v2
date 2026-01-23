// src/ui-kit/Card.tsx
import React from "react";
import { ui } from "./tokens";

type CardVariant = "hero" | "default" | "inner" | "row";

type CardProps = {
  children: React.ReactNode;
  variant?: CardVariant;
  style?: React.CSSProperties;
  className?: string;
};

/**
 * Card: canonical Income/Insights card container.
 * Variants map to styles already used inline in Income.tsx:
 * - hero/default -> cardStyle (border, radius 16, padding 18, bg 0.25, shadow)
 * - inner -> breakdown tile style (radius 14, padding 14, bg 0.18)
 * - row -> recent row style (radius 12, padding 10/12, softer border, bg 0.04)
 */
export function Card({ children, variant = "default", style, className }: CardProps) {
  const base: React.CSSProperties =
    variant === "inner"
      ? {
          border: ui.border.subtle,
          borderRadius: ui.radius.inner,
          padding: 14,
          background: ui.bg.inner,
        }
      : variant === "row"
      ? {
          border: ui.border.softer,
          borderRadius: ui.radius.row,
          padding: "10px 12px",
          background: ui.bg.row,
        }
      : {
          border: ui.border.subtle,
          borderRadius: ui.radius.card,
          padding: 18,
          background: ui.bg.card,
          boxShadow: ui.shadow.card,
        };

  return (
    <div className={className} style={{ ...base, ...style }}>
      {children}
    </div>
  );
}

/**
 * Container width helper: matches Income card width rule.
 * Use this to keep cards aligned across the page.
 */
export function ContentWidth({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        width: ui.page.contentWidth,
        margin: "0 auto",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
