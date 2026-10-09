import type { SVGProps } from "react";

const paths = {
  home: "M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z",
  gym: "M3 9v6M6 6v12M18 6v12M21 9v6M6 12h12",
  chart: "M5 20V10M12 20V4M19 20v-7",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20c.6-3.5 3.7-5.5 7.5-5.5s6.9 2 7.5 5.5",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  check: "m5 12.5 4.5 4.5L19 7.5",
  x: "m6 6 12 12M18 6 6 18",
  trash: "M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10 11v5M14 11v5",
  copy: "M9 9h10v11H9zM5 15V4h10",
  up: "m6 14 6-6 6 6",
  down: "m6 10 6 6 6-6",
  left: "m14 6-6 6 6 6",
  right: "m10 6 6 6-6 6",
  calendar: "M5 7h14v13H5zM5 11h14M9 4v4M15 4v4",
  trophy: "M8 4h8v5a4 4 0 0 1-8 0zM8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M8.5 20h7M10 17h4",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  flame: "M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 2.5 1.5 2C11 8 11 5.5 12 3z",
  edit: "m5 19 1-4 9-9 3 3-9 9zM14 7l3 3",
  more: "M6 12h.01M12 12h.01M18 12h.01",
  list: "M8 7h11M8 12h11M8 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01",
  play: "M8 5.5v13l10-6.5z",
  target: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  scale: "M5 5h14l1 15H4zM9 10a3 3 0 0 1 6 0",
  sun: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4",
  moon: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z",
  logout: "M10 5H5v14h5M15 8l4 4-4 4M19 12H9",
  fork: "M7 3v7M5 3v4a2 2 0 0 0 4 0V3M7 10v11M17 21V3c-2.5 1.5-4 4-4 8h4",
  apple: "M12 7.5C9.5 6 5.5 7 5.5 11.5c0 4 2.5 9.5 5 9.5 1 0 1-.5 1.5-.5s.5.5 1.5.5c2.5 0 5-5.5 5-9.5C18.5 7 14.5 6 12 7.5zM12 7.5c0-2 1-3.5 3-4.5",
  drop: "M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z",
  swap: "M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7",
  users: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.5-3.2 3.1-5 6.5-5s6 1.8 6.5 5M16 4.3a3.5 3.5 0 0 1 0 6.4M18 15.2c1.9.6 3.1 2 3.5 4.8",
  camera: "M4 8h3l1.5-2h7L17 8h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  share: "M12 4v11M8 8l4-4 4 4M5 14v6h14v-6",
  comment: "M5 5h14v10H10l-4 4v-4H5z",
  body: "M12 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 9h8l1 6h-2l-.5 7h-1.5v-6h-2v6H9.5L9 15H7z",
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 22, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={paths[name]} />
    </svg>
  );
}

/** Marchio: un disco da bilanciere. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill="currentColor" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="var(--bg)" strokeWidth="2" />
      <circle cx="16" cy="16" r="3" fill="var(--bg)" />
    </svg>
  );
}
