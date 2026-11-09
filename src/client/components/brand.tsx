import { useId } from "react";
import { cn } from "@/lib/utils";
import type { Page } from "../model.ts";

/** Two cards mid-deal — trade reads from the handoff, not from arrow chrome. */
export function TradeMark({ className }: { className?: string }) {
  const uid = useId().replaceAll(":", "");
  const cardA = `${uid}-card-a`;
  const cardB = `${uid}-card-b`;
  const sheen = `${uid}-sheen`;

  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-10", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={cardA} x1="4" y1="2" x2="22" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fde7b0" />
          <stop offset="1" stopColor="#f0b84d" />
        </linearGradient>
        <linearGradient id={cardB} x1="18" y1="6" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f8d9a0" />
          <stop offset="0.5" stopColor="#f472b6" />
          <stop offset="1" stopColor="#db2777" />
        </linearGradient>
        <linearGradient id={sheen} x1="14" y1="8" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff7e0" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff7e0" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Passing left — pulled back and under */}
      <g transform="translate(1 1)">
        <rect
          x="5"
          y="7"
          width="15"
          height="22"
          rx="2.2"
          transform="rotate(-22 12.5 18)"
          fill={`url(#${cardA})`}
          fillOpacity="0.16"
          stroke={`url(#${cardA})`}
          strokeWidth="2"
        />
        <circle cx="9.8" cy="12.4" r="1.25" fill="#fde7b0" />
        <path
          d="M9.2 16.5h5.2M9.2 19.2h3.8"
          stroke={`url(#${cardA})`}
          strokeWidth="1.3"
          strokeLinecap="round"
          opacity="0.55"
        />
      </g>

      {/* Passing right — over the top */}
      <g transform="translate(-1 1)">
        <rect
          x="19"
          y="9"
          width="15"
          height="22"
          rx="2.2"
          transform="rotate(18 26.5 20)"
          fill={`url(#${cardB})`}
          fillOpacity="0.22"
          stroke={`url(#${cardB})`}
          strokeWidth="2"
        />
        <rect
          x="21"
          y="12"
          width="8"
          height="12"
          rx="1.2"
          transform="rotate(18 25 18)"
          fill={`url(#${sheen})`}
        />
        <circle cx="30.2" cy="28.2" r="1.25" fill="#f9a8d4" />
      </g>
    </svg>
  );
}

export function BrandLink({
  onOpen,
  size = "md",
  showWordmark = true,
  className,
}: {
  onOpen: (page: Page, href: string) => void;
  size?: "md" | "lg";
  showWordmark?: boolean;
  className?: string;
}) {
  return (
    <a
      href="/"
      aria-label="KCC Trader"
      className={cn(
        "inline-flex shrink-0 items-center gap-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
      onClick={(event) => {
        event.preventDefault();
        onOpen("catalog", "/");
      }}
    >
      <TradeMark className={size === "lg" ? "size-14" : "size-11"} />
      {showWordmark ? (
        <span
          className={cn(
            "font-display leading-none font-extrabold tracking-tight",
            size === "lg" ? "text-3xl" : "text-2xl",
            size === "md" && "hidden sm:inline",
          )}
        >
          KCC <span className="text-amber-200">Trader</span>
        </span>
      ) : null}
    </a>
  );
}
