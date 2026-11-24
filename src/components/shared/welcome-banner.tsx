import { Trophy } from "lucide-react";
import type { ReactNode } from "react";

/** The school at sunrise, drawn in code so it needs no picture file. Decorative only. */
function CampusScene() {
  return (
    <svg
      viewBox="0 0 1100 260"
      preserveAspectRatio="xMaxYMax slice"
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
    >
      <defs>
        <linearGradient id="wb-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8a5a52" />
          <stop offset="0.55" stopColor="#e39a6c" />
          <stop offset="1" stopColor="#f6cf94" />
        </linearGradient>
        <radialGradient id="wb-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff3c4" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff3c4" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g transform="translate(460 0)">
        <rect x="-460" width="1100" height="260" fill="url(#wb-sky)" />
        <circle cx="400" cy="170" r="110" fill="url(#wb-sun)" />
        <g fill="#f3e3c3" stroke="#d8c29b" strokeWidth="1">
          <rect x="270" y="120" width="340" height="96" />
          <rect x="360" y="92" width="160" height="124" />
          <path d="M350 92 L440 62 L530 92 Z" fill="#e9d6b0" />
        </g>
        <g fill="#fff8e6">
          {[374, 400, 426, 452, 478, 504].map((x) => (
            <rect key={x} x={x} y="104" width="8" height="112" />
          ))}
        </g>
        <g fill="#8a6a46" opacity="0.85">
          {[286, 312, 338, 548, 574].flatMap((x) =>
            [136, 170].map((y) => (
              <rect key={`${x}-${y}`} x={x} y={y} width="16" height="22" rx="2" />
            )),
          )}
        </g>
        <rect x="418" y="140" width="44" height="14" rx="2" fill="#5b3a22" />
        <rect x="-460" y="212" width="1100" height="48" fill="#4e7d2a" />
        <rect x="-460" y="228" width="1100" height="32" fill="#3d6a1f" />
        <g>
          <circle cx="250" cy="190" r="34" fill="#4e9a1f" />
          <circle cx="228" cy="206" r="26" fill="#3d7f18" />
          <circle cx="620" cy="188" r="38" fill="#4e9a1f" />
          <circle cx="600" cy="208" r="26" fill="#3d7f18" />
        </g>
        <g fill="#f4a9c4">
          {[
            [590, 30, 14],
            [618, 52, 16],
            [570, 58, 11],
            [626, 14, 12],
            [548, 24, 9],
            [604, 82, 10],
          ].map(([x, y, r]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={r} opacity="0.92" />
          ))}
        </g>
      </g>
    </svg>
  );
}

/** Wide welcome banner for the top of a dashboard: greeting, a line of text and the campus. */
export function WelcomeBanner({
  title,
  subtitle,
  badge = "Academic Excellence",
  actions,
}: {
  title: string;
  subtitle: string;
  badge?: string;
  actions?: ReactNode;
}) {
  return (
    <section className="shadow-card relative mb-6 min-h-[190px] overflow-hidden rounded-3xl bg-[#3a1d12] lg:min-h-[220px]">
      <CampusScene />
      {/* A solid brown layer behind the words keeps them readable over the picture. */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#3a1d12_0%,#3a1d12_38%,rgb(58_29_18/0.7)_58%,transparent_82%)]" />
      <div className="relative z-10 flex h-full max-w-[34rem] flex-col justify-center gap-2 px-6 py-7 lg:px-9">
        <h1 className="font-display text-[clamp(1.9rem,4vw,2.9rem)] leading-tight text-[#f6d89a]">
          {title}
        </h1>
        <p className="text-on-dark max-w-[40ch]">{subtitle}</p>
        {actions ? <div className="mt-2 flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="absolute right-0 bottom-0 z-10 flex items-center gap-3 rounded-tl-[2.5rem] bg-[#1f4d1a] py-3 pr-6 pl-8 text-[#f6e7c3]">
        <Trophy className="size-8 text-[#e8b84a]" aria-hidden="true" />
        <span className="font-display text-xl leading-tight">{badge}</span>
      </div>
    </section>
  );
}

/** "Good morning", "Good afternoon" or "Good evening" for the hour of the day. */
export function greeting(date = new Date()) {
  const h = date.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
