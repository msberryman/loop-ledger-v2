// src/pages/Login.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

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

  const title = mode === "login" ? "Log in to Loop Ledger" : "Create your Loop Ledger account";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#050816",
        color: "#f9fafb",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          padding: 32,
          borderRadius: 16,
          background:
            "radial-gradient(circle at top, rgba(59,130,246,0.25), transparent 55%), #111827",
          boxShadow: "0 18px 45px rgba(0,0,0,0.55)",
          border: "1px solid rgba(148,163,184,0.4)",
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          {title}
        </h1>
        <p style={{ fontSize: 14, opacity: 0.8, marginBottom: 20 }}>
          Track loops, tips, expenses, and mileage in one clean ledger.
        </p>

        {error && (
          <div
            style={{
              marginBottom: 16,
              padding: "8px 10px",
              borderRadius: 8,
              fontSize: 13,
              background: "rgba(248,113,113,0.15)",
              border: "1px solid rgba(248,113,113,0.55)",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(148,163,184,0.6)",
              background: "rgba(15,23,42,0.95)",
              color: "#e5e7eb",
              marginBottom: 14,
              outline: "none",
            }}
          />

          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
            Password
          </label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(148,163,184,0.6)",
              background: "rgba(15,23,42,0.95)",
              color: "#e5e7eb",
              marginBottom: 16,
              outline: "none",
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "none",
              background:
                mode === "login" ? "rgba(59,130,246,0.95)" : "rgba(16,185,129,0.95)",
              color: "#f9fafb",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              marginBottom: 10,
            }}
          >
            {loading
              ? mode === "login"
                ? "Logging in…"
                : "Signing up…"
              : mode === "login"
              ? "Log In"
              : "Sign Up"}
          </button>

          <button
            type="button"
            onClick={() =>
              setMode((m) => (m === "login" ? "signup" : "login"))
            }
            disabled={loading}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(148,163,184,0.7)",
              background: "transparent",
              color: "#e5e7eb",
              fontSize: 13,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {mode === "login"
              ? "Need an account? Sign up"
              : "Already have an account? Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}

