"use client";

import { BACK, BASE_SHAPES, FRONT, VIEWBOX, type Region } from "./regions";
import { LEVEL_LABEL, type Level } from "@/modules/strength/domain/levels";
import { MUSCLE_NAME } from "@/config/muscles";

/**
 * Mappa del corpo data-driven. Il colore di ogni muscolo è quello del suo livello
 * (variabili CSS --lv-*), mai un colore arbitrario.
 */
export function BodyMap({
  view,
  levels,
  selected,
  onSelect,
}: {
  view: "front" | "back";
  levels: Record<string, Level>;
  selected: string | null;
  onSelect: (muscleId: string) => void;
}) {
  const regions: Region[] = view === "front" ? FRONT : BACK;
  const mirror = (key: string, inner: React.ReactNode) => (
    <>
      <g key={key + "r"}>{inner}</g>
      <g key={key + "l"} transform="translate(200 0) scale(-1 1)">
        {inner}
      </g>
    </>
  );

  return (
    <svg viewBox={VIEWBOX} className="mx-auto h-auto w-full max-w-[340px]" role="group" aria-label={view === "front" ? "Corpo, vista frontale" : "Corpo, vista posteriore"}>
      <path d={BASE_SHAPES.head} fill="var(--body-base)" />
      <path d={BASE_SHAPES.center} fill="var(--body-base)" />
      {mirror("base", BASE_SHAPES.half.map((d, i) => <path key={i} d={d} fill="var(--body-base)" />))}

      {regions.map((r) => {
        const level = levels[r.muscleId] ?? "unranked";
        const isSel = selected === r.muscleId;
        return (
          <g
            key={r.muscleId}
            className={`lv-${level} cursor-pointer outline-none`}
            role="button"
            tabIndex={0}
            aria-label={`${MUSCLE_NAME[r.muscleId]}: ${LEVEL_LABEL[level]}`}
            aria-pressed={isSel}
            onClick={() => onSelect(r.muscleId)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(r.muscleId);
              }
            }}
            style={{ opacity: selected && !isSel ? 0.55 : 1, transition: "opacity .15s" }}
          >
            {mirror(
              "reg",
              <>
                {r.paths.map((d, i) => (
                  <path
                    key={i}
                    d={d}
                    fill="var(--lv)"
                    stroke={isSel ? "var(--fg)" : "var(--bg)"}
                    strokeWidth={isSel ? 2.4 : 1.6}
                    strokeLinejoin="round"
                  />
                ))}
                {(r.details ?? []).map((d, i) => (
                  <path key={"d" + i} d={d} fill="none" stroke="var(--bg)" strokeWidth="1.3" strokeLinecap="round" opacity="0.8" />
                ))}
              </>,
            )}
          </g>
        );
      })}
    </svg>
  );
}
