// src/AppShell.tsx
import React from "react";
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
import BottomNav from "./components/BottomNav"; // <-- NEW

export default function AppShell() {
  const location = useLocation();

  // Show login without layout chrome
  const isLogin = location.pathname === "/login";
  const isMobile = window.innerWidth < 900; // <-- NEW

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
            paddingBottom: isMobile ? "60px" : "0px", // <-- Space for bottom nav
          }}
        >
          {routeElements}
        </div>
      </Layout>

      {/* MOBILE-ONLY BOTTOM NAV */}
      {isMobile && <BottomNav />} {/* <-- NEW */}
    </>
  );
}

