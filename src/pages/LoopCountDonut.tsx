import React, { useMemo } from "react";

export default function LoopCountDonut({ data }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  const enriched = useMemo(() => {
    return data.map(d => ({
      ...d,
      value: d.count,
      pct: total > 0 ? d.count / total : 0,
    }));
  }, [data, total]);

  // donut dimensions
  const size = 240;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <div style={{ textAlign: "center" }}>
      
      {/* Title */}
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
        Loop Distribution
      </div>

      {/* Donut */}
      <svg width={size} height={size}>
        {/* background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(120,120,120,.25)"
          strokeWidth={stroke}
          fill="none"
        />

        {enriched.map((d, i) => {
          const segmentLength = d.pct * circumference;
          const dash = `${segmentLength} ${circumference - segmentLength}`;
          const circle = (
            <circle
              key={d.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={d.color}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={dash}
              strokeDashoffset={-offset}
            />
          );
          offset += segmentLength;
          return circle;
        })}
      </svg>

      {/* Center numbers */}
      <div
        style={{
          position: "relative",
          marginTop: `-${size * 0.62}px`,
          height: 0,
        }}
      >
        <div style={{
          fontSize: 22,
          fontWeight: 800,
          color: "white",
        }}>
          {total}
        </div>
        <div style={{
          fontSize: 12,
          color: "rgba(220,220,220,.75)",
        }}>
          total loops
        </div>
      </div>

      {/* Legend */}
      <div style={{ marginTop: size * 0.35 }}>
        {enriched.map((d) => (
          <div
            key={d.label}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              margin: "4px 0",
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: d.color,
              }}
            />
            <div style={{ fontSize: 14 }}>
              {d.label}
            </div>
            <div style={{ fontSize: 14, opacity: 0.65 }}>
              {d.value}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
