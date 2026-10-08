"use client";

import { useEffect, useRef, useState } from "react";
import { fmtDate, fmtNum } from "@/lib/format";

/** Solo stringhe/numeri come props: i componenti server non possono passare funzioni a un client component. */
export type NumFormat = "d0" | "d1" | "d2";
const fmtBy = (f: NumFormat, n: number) => fmtNum(n, f === "d0" ? 0 : f === "d1" ? 1 : 2);

function useWidth(initial = 320) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.round(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceStep(raw: number) {
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

export type LinePoint = { t: number; y: number; note?: string };

/** Grafico a linea reattivo, disegnato in SVG. Tocca o passa sopra per leggere un punto. */
export function LineChart({
  points,
  height = 220,
  yFormat = "d1",
  tz = "Europe/Rome",
  unit = "",
}: {
  points: LinePoint[];
  height?: number;
  yFormat?: NumFormat;
  tz?: string;
  unit?: string;
}) {
  const formatY = (n: number) => fmtBy(yFormat, n);
  const formatT = (t: number) => fmtDate(new Date(t), tz, { day: "numeric", month: "short" });
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);

  if (points.length === 0) return null;
  const pad = { l: 44, r: 14, t: 14, b: 26 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;

  const ys = points.map((p) => p.y);
  let min = Math.min(...ys);
  let max = Math.max(...ys);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const step = niceStep((max - min) / 3);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(v);

  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const x = (t: number) => pad.l + (t1 === t0 ? w / 2 : ((t - t0) / (t1 - t0)) * w);
  const y = (v: number) => pad.t + h - ((v - lo) / (hi - lo)) * h;

  const line = points.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)} ${y(p.y).toFixed(1)}`).join(" ");
  const area = `${line} L${x(t1).toFixed(1)} ${pad.t + h} L${x(t0).toFixed(1)} ${pad.t + h} Z`;
  const active = hover !== null ? points[hover] : points[points.length - 1];

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = 0;
    let bd = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(x(p.t) - px);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    setHover(best);
  }

  const xTicks = points.length === 1 ? [points[0]] : [points[0], points[Math.floor((points.length - 1) / 2)], points[points.length - 1]];

  return (
    <div ref={ref} className="w-full select-none">
      <div className="mb-1 flex items-baseline gap-2">
        <span className="num text-3xl font-semibold">
          {formatY(active.y)}
          {unit && <span className="ml-1 text-base font-medium text-muted">{unit}</span>}
        </span>
        <span className="text-sm text-muted">{formatT(active.t)}</span>
        {active.note && <span className="text-sm text-muted">{active.note}</span>}
      </div>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Grafico"
        className="touch-pan-y"
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth="1" />
            <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize="12" fill="var(--muted)">
              {formatY(v)}
            </text>
          </g>
        ))}
        {xTicks.map((p, i) => (
          <text
            key={p.t + "-" + i}
            x={x(p.t)}
            y={height - 6}
            textAnchor={i === 0 && xTicks.length > 1 ? "start" : i === xTicks.length - 1 && xTicks.length > 1 ? "end" : "middle"}
            fontSize="12"
            fill="var(--muted)"
          >
            {formatT(p.t)}
          </text>
        ))}
        <path d={area} fill="var(--fg)" opacity="0.07" />
        <path d={line} fill="none" stroke="var(--fg)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.length <= 40 &&
          points.map((p, i) => (
            <circle key={i} cx={x(p.t)} cy={y(p.y)} r={2.5} fill="var(--fg)" />
          ))}
        {hover !== null && (
          <line x1={x(active.t)} x2={x(active.t)} y1={pad.t} y2={pad.t + h} stroke="var(--muted)" strokeDasharray="3 4" />
        )}
        <circle cx={x(active.t)} cy={y(active.y)} r={6} fill="var(--bg)" stroke="var(--fg)" strokeWidth="3" />
      </svg>
    </div>
  );
}

export type BarPoint = { label: string; value: number };

export function BarChart({
  data,
  height = 180,
  valueUnit = "",
}: {
  data: BarPoint[];
  height?: number;
  valueUnit?: string;
}) {
  const formatValue = (n: number) => `${fmtNum(Math.round(n), 0)}${valueUnit}`;
  const [ref, width] = useWidth();
  const [sel, setSel] = useState<number | null>(null);
  const pad = { l: 6, r: 6, t: 8, b: 24 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const bw = (width - pad.l - pad.r) / data.length;
  const h = height - pad.t - pad.b;
  const active = sel ?? data.length - 1;

  return (
    <div ref={ref} className="w-full select-none">
      <div className="mb-1 flex items-baseline gap-2">
        <span className="num text-3xl font-semibold">{formatValue(data[active].value)}</span>
        <span className="text-sm text-muted">sett. del {data[active].label}</span>
      </div>
      <svg width={width} height={height} role="img" aria-label="Grafico a barre">
        {data.map((d, i) => {
          const bh = Math.max(d.value > 0 ? 3 : 0, (d.value / max) * h);
          return (
            <g key={i} onPointerDown={() => setSel(i)} onPointerEnter={() => setSel(i)}>
              <rect x={pad.l + i * bw} y={0} width={bw} height={height} fill="transparent" />
              <rect
                x={pad.l + i * bw + bw * 0.18}
                y={pad.t + h - bh}
                width={bw * 0.64}
                height={bh}
                rx={5}
                fill="var(--fg)"
                opacity={i === active ? 1 : 0.28}
              />
              {(i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2)) && (
                <text x={pad.l + i * bw + bw / 2} y={height - 6} textAnchor="middle" fontSize="12" fill="var(--muted)">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
