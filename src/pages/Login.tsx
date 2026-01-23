// src/pages/Login.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

import { Card, Button, ContentWidth } from "../ui-kit";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "login") {
        const { error: err } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
        });
        if (err) throw err;
      }

      // On success, go to Home; ProtectedRoute + useSession
      // will let us in once Supabase reports a session.
      navigate("/home", { replace: true });
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const title = mode === "login" ? "Log in" : "Create account";
  const subtitle =
    mode === "login"
      ? "Track loops, tips, expenses, and mileage in one clean ledger."
      : "Create your account to start tracking loops, tips, and mileage.";

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.04)",
    color: "#f9fafb",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    opacity: 0.75,
    marginBottom: 6,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "18px 16px 28px",
        background: "#050816",
        color: "#f9fafb",
      }}
    >
      <ContentWidth style={{ width: "min(420px, 100%)" }}>
        <Card>
          {/* Logo */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <img
              src="/loop-ledger-logo.svg"
              alt="Loop Ledger"
              style={{
                width: 84,
                height: 84,
                borderRadius: 999,
                boxShadow: "0 10px 35px rgba(0,0,0,0.45)",
              }}
            />
          </div>

          {/* Title + subtitle (Income/Insights typography rhythm) */}
          <div style={{ textAlign: "center", marginBottom: 18 }}>
            <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>{title}</div>
            <div style={{ fontSize: 14, opacity: 0.75 }}>{subtitle}</div>
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                marginBottom: 14,
                padding: "10px 12px",
                borderRadius: 12,
                fontSize: 13,
                background: "rgba(248,113,113,0.12)",
                border: "1px solid rgba(248,113,113,0.45)",
              }}
            >
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={inputStyle}
                autoComplete="email"
              />
            </div>

            <div>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>

            <Button type="submit" variant="primary" disabled={loading} style={{ width: "100%" }}>
              {loading ? (mode === "login" ? "Logging in…" : "Signing up…") : mode === "login" ? "Log In" : "Sign Up"}
            </Button>

            {/* Secondary action as muted text link (per checklist) */}
            <button
              type="button"
              onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
              disabled={loading}
              style={{
                border: "none",
                background: "transparent",
                color: "rgba(255,255,255,0.75)",
                cursor: loading ? "not-allowed" : "pointer",
                padding: 8,
                fontSize: 13,
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
            </button>
          </form>
        </Card>

        {/* Tiny footer (optional but nice) */}
        <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, opacity: 0.55 }}>
          Loop Ledger
        </div>
      </ContentWidth>
    </div>
  );
}
