import React, { useState, useEffect } from "react";
import { getLoops } from "../lib/storage";

export default function Insights() {
  const [loops, setLoops] = useState([]);

  // Load data on mount
  useEffect(() => {
    const stored = getLoops();
    if (Array.isArray(stored)) setLoops(stored);
  }, []);

  const totalLoops = loops.length;

  // Avg income per loop
  const avgIncome =
    totalLoops > 0
      ? loops.reduce(
          (sum, l) =>
            sum +
            Number(l.bagFee || 0) +
            Number(l.preGratuity || 0) +
            Number(l.cashTip || 0) +
            Number(l.digitalTip || 0),
          0
        ) / totalLoops
      : 0;

  // Avg pace of play
  const avgPace =
    totalLoops > 0
      ? loops.reduce((sum, l) => sum + Number(l.paceMinutes || 0), 0) /
        totalLoops
      : 0;

  // Avg wait time
  const avgWait =
    totalLoops > 0
      ? loops.reduce((sum, l) => sum + Number(l.waitMinutes || 0), 0) /
        totalLoops
      : 0;

  function fmtTime(v) {
    if (!v || isNaN(v)) return "0m";
    return Number(v).toFixed(0) + "m";
  }

  function fmtMoney(v) {
    if (!v || isNaN(v)) return "$0";
    return "$" + Number(v).toFixed(0);
  }

  return (
    <div style={{ padding: "20px" }}>
      <h2>Loop Insights</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "20px",
          marginTop: "20px",
        }}
      >
        <div
          style={{
            background: "#1E1E1E",
            padding: "15px",
            borderRadius: "8px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "14px", color: "#aaa" }}>Avg $ Per Loop</div>
          <div style={{ fontSize: "28px" }}>{fmtMoney(avgIncome)}</div>
        </div>

        <div
          style={{
            background: "#1E1E1E",
            padding: "15px",
            borderRadius: "8px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "14px", color: "#aaa" }}>Avg Pace</div>
          <div style={{ fontSize: "28px" }}>{fmtTime(avgPace)}</div>
        </div>

        <div
          style={{
            background: "#1E1E1E",
            padding: "15px",
            borderRadius: "8px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "14px", color: "#aaa" }}>Avg Wait</div>
          <div style={{ fontSize: "28px" }}>{fmtTime(avgWait)}</div>
        </div>
      </div>
    </div>
  );
}
