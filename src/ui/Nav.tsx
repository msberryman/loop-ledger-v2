// src/ui/Nav.tsx
import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { tokens } from "./tokens";
import { HomeIcon, SettingsIcon } from "./Icons";

type NavItem = {
  path: string;
  label: "Home" | "Loops" | "Expenses" | "Income" | "Insights" | "Settings";
  Icon?: React.FC<React.SVGProps<SVGSVGElement>>; // only for Home + Settings
};

// same nav items as always
export const NAV: readonly NavItem[] = [
  { path: "/home", label: "Home", Icon: HomeIcon }, // icon-only
  { path: "/loops", label: "Loops" }, // text label
  { path: "/expenses", label: "Expenses" }, // text label
  { path: "/income", label: "Income" }, // text label
  { path: "/insights", label: "Insights" }, // text label
  { path: "/settings", label: "Settings", Icon: SettingsIcon }, // icon-only
] as const;

function useIsMobile(breakpointPx = 900) {
  const query = `(max-width: ${breakpointPx - 1}px)`;

  const getMql = () => {
    if (typeof window === "undefined") return null;
    if (typeof window.matchMedia !== "function") return null; // ✅ vitest/jsdom safe
    return window.matchMedia(query);
  };

  const [isMobile, setIsMobile] = useState(() => {
    const mql = getMql();
    return mql ? mql.matches : false;
  });

  useEffect(() => {
    const mql = getMql();
    if (!mql) return; // ✅ no-op in tests

    const onChange = () => setIsMobile(mql.matches);

    // Set once on mount
    onChange();

    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener(onChange);

    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange);
    };
  }, [breakpointPx]);

  return isMobile;
}


export const TopNav: React.FC = () => {
  const { pathname } = useLocation();

  // hide on mobile
  const isMobile = useIsMobile(900);
  if (isMobile) return null;

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: tokens.color.bg,
        borderBottom: `1px solid ${tokens.color.border}`,
      }}
      aria-label="Primary"
    >
      <div
        style={{
          display: "flex",
          justifyContent: "center", // ✅ CENTER DESKTOP NAV
          gap: 10,
          padding: 10,
          maxWidth: 980,
          margin: "0 auto",
        }}
      >
        {NAV.map(({ path, label, Icon }) => {
          const active = pathname === path;

          return (
            <Link
              key={path}
              to={path}
              aria-label={label}
              title={label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "0 10px",
                height: 36,
                borderRadius: 10,
                color: active ? tokens.color.brand : tokens.color.text,
                textDecoration: "none",
                background: active ? "rgba(92,200,255,0.12)" : "transparent",
                border: active
                  ? `1px solid ${tokens.color.border}`
                  : "1px solid transparent",
              }}
            >
              {Icon ? <Icon /> : <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
