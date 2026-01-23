// src/components/BottomNav.tsx
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { HomeIcon, SettingsIcon } from "../ui/Icons";

export default function BottomNav() {
  const loc = useLocation();

  const tab = (path: string, label: string | null, icon: React.ReactNode | null) => (
    <Link
      to={path}
      style={{
        flex: 1,
        textAlign: "center",
        padding: "6px 0 0 0",
        color: loc.pathname === path ? "#ffffff" : "rgba(255,255,255,0.6)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        textDecoration: "none",
      }}
    >
      {icon && (
        <div
          style={{
            width: 22,
            height: 22,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
          }}
        >
          {icon}
        </div>
      )}
      {label && <div style={{ marginTop: icon ? 3 : 0 }}>{label}</div>}
    </Link>
  );

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 58,
        background: "rgba(0,0,0,0.92)",
        display: "flex",
        alignItems: "center",
        borderTop: "1px solid rgba(255,255,255,0.12)",
        zIndex: 999,
      }}
    >
      {tab("/home", null, <HomeIcon />)}
      {tab("/loops", "Loops", null)}
      {tab("/expenses", "Expenses", null)}
      {tab("/income", "Income", null)}
      {tab("/insights", "Insights", null)}
      {tab("/settings", null, <SettingsIcon />)}
    </div>
  );
}
