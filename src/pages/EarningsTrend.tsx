import React, { useState, useMemo } from "react";

export default function EarningsTrend({ loops }) {
  const [range, setRange] = useState<"7D"|"14D"|"30D"|"MTD"|"YTD"|"ALL">("30D");

  // =========================
  // BUILD DAILY EARNINGS MAP
  // =========================
  const earningsByDay = useMemo(() => {
    const map: Record<string,{date:Date,total:number}> = {};
    
    for(const L of loops){
      const dateKey = (new Date(L.date)).toISOString().slice(0,10);
      const bag = Number(L.bagFee||0);
      const tips = Number(L.tipCash||0)+Number(L.tipDigital||0);
      if(!map[dateKey]) map[dateKey]={date:new Date(L.date), total:0};
      map[dateKey].total += (bag+tips);
    }
    return Object.values(map).sort((a,b)=>a.date.getTime()-b.date.getTime());
  }, [loops]);

  // =========================
  // DATE RANGE FILTERING
  // =========================
  const filtered = useMemo(()=>{
    if(range==="ALL") return earningsByDay;
    
    const today = new Date();
    const firstDayThisMonth = new Date(today.getFullYear(), today.getMonth(),1);
    const firstDayThisYear = new Date(today.getFullYear(),0,1);
    const now = today.getTime();

    function daysBack(n:number){
      const cutoff=now-(n*24*60*60*1000);
      return earningsByDay.filter(d=>d.date.getTime()>=cutoff);
    }

    if(range==="7D") return daysBack(7);
    if(range==="14D") return daysBack(14);
    if(range==="30D") return daysBack(30);
    if(range==="MTD") return earningsByDay.filter(d=>d.date>=firstDayThisMonth);
    if(range==="YTD") return earningsByDay.filter(d=>d.date>=firstDayThisYear);

    return earningsByDay;
  }, [earningsByDay, range]);

  // =========================
  // DETERMINE MAX VALUE
  // =========================
  const max = filtered.length ? Math.max(...filtered.map(d=>d.total)) : 0;

  // =========================
  // HOVER STATE
  // =========================
  const [hoverIndex, setHoverIndex] = useState<number|null>(null);

  // =========================
  // MONEY FORMAT
  // =========================
  function fmtMoney(n:number){
    return "$" + Math.round(n).toLocaleString();
  }

  return (
    <div>

      {/* RANGE SELECTOR */}
      <div style={{
        display:"flex",
        gap:6,
        marginBottom:20,
        flexWrap:"wrap"
      }}>
        {(["7D","14D","30D","MTD","YTD","ALL"] as const).map(r=>(
          <button
            key={r}
            onClick={()=>setRange(r)}
            style={{
              padding:"4px 12px",
              borderRadius:6,
              border:`1px solid ${range===r ? "#4CAF50" : "rgba(255,255,255,.2)"}`,
              background: range===r ? "rgba(76,175,80,.18)" : "transparent",
              color: range===r ? "#4CAF50" : "rgba(255,255,255,.65)",
              fontWeight: range===r ? 700 : 400,
              fontSize:13,
              cursor:"pointer"
            }}
          >
            {r}
          </button>
        ))}
      </div>

      {/* LINE CHART */}
      <svg width="100%" height="140" style={{ overflow:"visible" }}>
        {filtered.length>1 && (() => {
          const pts = filtered.map((d,i)=>{
            const x = (i/(filtered.length-1))*100;
            const y = 100 - (d.total/max)*100;
            return {x,y};
          });

          const path = pts.map((p,i)=>
            `${i===0 ? "M":"L"} ${p.x} ${p.y}`
          ).join(" ");

          return (
            <>
              {/* PATH */}
              <path
                d={path}
                stroke="#4CAF50"
                strokeWidth="2"
                fill="none"
                vectorEffect="non-scaling-stroke"
              />

              {/* NODES */}
              {pts.map((p,i)=>(
                <circle
                  key={i}
                  cx={`${p.x}%`}
                  cy={`${p.y}%`}
                  r={hoverIndex===i ? 6 : 4}
                  fill={hoverIndex===i ? "#A5D6A7" : "#81C784"}
                  style={{ cursor:"pointer" }}
                  onMouseEnter={()=>setHoverIndex(i)}
                  onMouseLeave={()=>setHoverIndex(null)}
                  onTouchStart={()=>setHoverIndex(i)}
                />
              ))}

              {/* TOOLTIP */}
              {hoverIndex!==null && (
                <text
                  x={`${pts[hoverIndex].x}%`}
                  y={`${pts[hoverIndex].y}%`}
                  dy="-10"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="12"
                  fontWeight="600"
                  style={{ pointerEvents:'none' }}
                >
                  {fmtMoney(filtered[hoverIndex].total)}
                </text>
              )}
            </>
          );
        })()}
      </svg>

    </div>
  );
}
