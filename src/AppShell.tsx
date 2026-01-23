// src/AppShell.tsx
import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Layout } from "./ui/Layout";

import HomePage from "./pages/Home";
import LoopsPage from "./pages/Loops";
import ExpensesPage from "./pages/Expenses";
import IncomePage from "./pages/Income";
import InsightsPage from "./pages/Insights";
import SettingsPage from "./pages/Settings";
import Login from "./pages/Login";
import ProtectedRoute from "./routes/ProtectedRoute";
import BottomNav from "./components/BottomNav";

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


export default function AppShell() {
  const location = useLocation();

  // Show login without layout chrome
  const isLogin = location.pathname === "/login";
  const isMobile = useIsMobile(900);

  const routeElements = (
    <Routes>
      {/* Public route */}
      <Route path="/login" element={<Login />} />

      {/* Protected routes */}
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/loops"
        element={
          <ProtectedRoute>
            <LoopsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/expenses"
        element={
          <ProtectedRoute>
            <ExpensesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/income"
        element={
          <ProtectedRoute>
            <IncomePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/insights"
        element={
          <ProtectedRoute>
            <InsightsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />

      {/* Default redirects */}
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );

  if (isLogin) {
    return routeElements;
  }

  return (
    <>
      <Layout>
        <div
          style={{
            paddingBottom: isMobile ? "60px" : "0px", // Space for bottom nav
          }}
        >
          {routeElements}
        </div>
      </Layout>

      {/* MOBILE-ONLY BOTTOM NAV */}
      {isMobile && <BottomNav />}
    </>
  );
}
