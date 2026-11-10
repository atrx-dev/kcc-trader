import { type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Check, Copy, Heart, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { isNewCard, type Card } from "../../types.ts";
import { frameUrl, hasFrame, namePlateStyle } from "../frame.ts";
import { KccChanHolo } from "./kcc-chan-holo.tsx";
import { isStandardShineBorder, StandardBorderShine } from "./standard-border-shine.tsx";

export const SSS_STARS = [
  [9, 12], [82, 8], [24, 31], [69, 23], [94, 41], [14, 58],
  [78, 63], [41, 10], [90, 72], [8, 82], [59, 48], [31, 70],
] as const;

export const BESTIES_STARS = [
  [6, 10], [92, 14], [14, 69], [86, 57], [5, 89], [94, 82], [22, 92], [80, 94],
] as const;

function cardLabel(card: Card): string {
  return `${card.name} ${card.eventName ?? ""} ${card.variantName ?? ""}`.toLowerCase();
}

export function isBesties(card: Card): boolean {
  return card.holo === "besties" || cardLabel(card).includes("besties");
}

export function isKccChan(card: Card): boolean {
  return card.holo === "kcc-chan" || cardLabel(card).includes("kcc-chan");
}

export function cardFinish(card: Card): string | undefined {
  if (card.holo) return card.holo;
  if (isKccChan(card)) return "kcc-chan";
  if (isBesties(card)) return "besties";
  return undefined;
}

export function tiltFoil(event: ReactPointerEvent<HTMLDivElement>) {
  if (event.pointerType === "touch" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  event.currentTarget.style.setProperty("--foil-x", `${x * 100}%`);
  event.currentTarget.style.setProperty("--foil-y", `${y * 100}%`);
  event.currentTarget.style.setProperty("--tilt-x", `${(0.5 - y) * 8}deg`);
  event.currentTarget.style.setProperty("--tilt-y", `${(x - 0.5) * 10}deg`);
}

export function resetFoil(event: ReactPointerEvent<HTMLDivElement>) {
  event.currentTarget.style.setProperty("--tilt-x", "0deg");
  event.currentTarget.style.setProperty("--tilt-y", "0deg");
}

export function FoilCard({ card, children }: { card: Card; children: ReactNode }) {
  const finish = cardFinish(card);
  const besties = finish === "besties";
  const kccChan = finish === "kcc-chan";
  const border = card.border || "starry";
  const halloween = border.startsWith("halloween-");
  const standardShine = isStandardShineBorder(border);
  const stars = besties ? BESTIES_STARS : SSS_STARS;
  return (
    <div className="foil-stage">
      <div
        className="foil-sample"
        data-tier={besties ? "SS" : card.rank}
        data-holo={finish ?? (card.rank === "SSS" ? border : undefined)}
        data-frame-only={halloween ? "true" : "false"}
        style={{
          ["--foil-strength" as string]: halloween ? 0.36 : 0.8,
          ["--foil-frame" as string]: `url("${frameUrl(card)}")`,
        }}
        onPointerMove={tiltFoil}
        onPointerLeave={resetFoil}
      >
        {children}
        {kccChan ? (
          <KccChanHolo />
        ) : standardShine ? (
          <StandardBorderShine border={border} />
        ) : (
          <div className="foil-treatment" aria-hidden="true">
            <div className="foil-color" />
            <div className="foil-grain" />
            <div className="foil-sweep" />
            <div className="foil-glare" />
            {card.rank === "SSS" || besties ? (
              <div className="foil-stars">
                {stars.map(([left, top], index) => (
                  <i
                    key={`${left}-${top}`}
                    style={{
                      left: `${left}%`,
                      top: `${top}%`,
                      animationDelay: `-${index * 0.47}s`,
                      width: index % 3 === 0 ? 16 : 9,
                      height: index % 3 === 0 ? 16 : 9,
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function PriorityMark() {
  return (
    <span
      className="priority-mark pointer-events-none absolute top-3 right-3 z-10 inline-flex items-center gap-1 rounded-full bg-[#f3d58f] px-1.5 py-1 text-[11px] leading-none font-bold text-[#1b1509] shadow-[0_2px_10px_rgba(0,0,0,0.5)]"
      aria-hidden="true"
    >
      <Star className="size-3 shrink-0 fill-current" />
      <span className="priority-label">Priority</span>
    </span>
  );
}

function PriorityToggle({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? "Remove priority" : "Mark as priority"}
      onClick={onClick}
      className={cn(
        "absolute top-3 right-3 z-10 inline-flex size-8 items-center justify-center rounded-full bg-black/55 shadow-[0_2px_10px_rgba(0,0,0,0.5)] outline-none hover:bg-black/70 focus-visible:ring-3 focus-visible:ring-ring/50",
        active ? "text-[#f3d58f]" : "text-white/85 hover:text-white",
      )}
    >
      <Star className={cn("size-4", active && "fill-current")} />
    </button>
  );
}

function WantedMark({ count }: { count: number }) {
  return (
    <span
      className="pointer-events-none inline-flex h-5 items-center gap-1 rounded-full bg-rose-200 px-1.5 py-1 text-[11px] leading-none font-bold text-rose-950 shadow-[0_2px_10px_rgba(0,0,0,0.5)]"
      aria-label={count === 1 ? "1 person has this wishlisted" : `${count} people have this wishlisted`}
    >
      <Heart className="size-3 shrink-0 fill-current" aria-hidden="true" />
      <span className="tabular-nums">{count}</span>
    </span>
  );
}

function NewMark() {
  return (
    <span className="new-mark pointer-events-none inline-flex h-5 items-center rounded-full bg-sky-200 px-1.5 py-1 text-[11px] leading-none font-bold text-sky-950 shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
      New
    </span>
  );
}

function OwnedMark() {
  return (
    <span
      className="owned-mark pointer-events-none inline-flex h-5 max-w-full items-center gap-1 rounded-full bg-emerald-200 px-1.5 py-1 text-[11px] leading-none font-bold text-emerald-950 shadow-[0_2px_10px_rgba(0,0,0,0.5)]"
      aria-label="Owned"
    >
      <Check className="size-3 shrink-0" aria-hidden="true" />
      <span className="owned-label">Owned</span>
    </span>
  );
}

function DuplicateMark({ count }: { count: number }) {
  return (
    <span
      className="duplicate-mark pointer-events-none inline-flex h-5 max-w-full items-center gap-1 rounded-full bg-[#f3d58f] px-1.5 py-1 text-[11px] leading-none font-bold text-[#1b1509] shadow-[0_2px_10px_rgba(0,0,0,0.5)]"
      aria-label={`Duplicate, ${count} copies`}
    >
      <Copy className="size-3 shrink-0" aria-hidden="true" />
      <span className="duplicate-short">×{count}</span>
      <span className="duplicate-long">{count} copies</span>
    </span>
  );
}

export function CardFace({
  card,
  copies = 0,
  owned = false,
  priority = false,
  wanted = 0,
  lazy = false,
  effects = true,
  onPriority,
}: {
  card: Card;
  copies?: number;
  owned?: boolean;
  priority?: boolean;
  wanted?: number;
  lazy?: boolean;
  effects?: boolean;
  onPriority?: () => void;
}) {
  const holo = effects && (card.rank === "S" || card.rank === "SS" || card.rank === "SSS");
  const fresh = isNewCard(card);
  const framed = hasFrame(card);
  const face = (
    <div
      className={cn(
        "card",
        framed ? "framed-card" : "full-art-card",
        holo && "foil",
      )}
      data-rank={card.rank}
      data-sss-border={card.rank === "SSS" && framed ? card.border || "starry" : undefined}
      aria-label={`${card.name}${card.variantName ? `, ${card.variantName}` : ""}, ${card.rank}, ${card.game} by ${card.creator}${fresh ? ", new" : ""}${priority ? ", priority" : ""}${copies > 1 ? `, ${copies} copies` : owned ? ", owned" : ""}${wanted > 0 ? `, wishlisted by ${wanted}` : ""}`}
    >
      {card.image ? (
        <img
          className="card-artwork"
          src={card.image}
          alt=""
          decoding="async"
          loading={lazy ? "lazy" : undefined}
          fetchPriority={lazy ? "low" : undefined}
        />
      ) : (
        <div className="art-fallback" />
      )}
      {framed ? <img className="card-border" src={frameUrl(card)} alt="" decoding="async" loading={lazy ? "lazy" : undefined} /> : null}
      {framed ? (
        <footer style={namePlateStyle(card)}>
          <strong title={card.variantName ? `${card.name} (${card.variantName})` : card.name}>{card.name}</strong>
          <span title={card.game}>{card.game}</span>
          {card.creator ? <span title={`by ${card.creator}`}>by {card.creator}</span> : null}
        </footer>
      ) : null}
    </div>
  );
  return (
    <div className="card-stack">
      {holo ? <FoilCard card={card}>{face}</FoilCard> : face}
      {onPriority ? <PriorityToggle active={priority} onClick={onPriority} /> : priority ? <PriorityMark /> : null}
      {copies > 1 || owned || fresh || wanted > 0 ? (
        <div className="pointer-events-none absolute top-3 left-3 z-10 flex max-w-[calc(100%-3.25rem)] flex-wrap items-center gap-1">
          {copies > 1 ? <DuplicateMark count={copies} /> : owned ? <OwnedMark /> : null}
          {fresh ? <NewMark /> : null}
          {wanted > 0 ? <WantedMark count={wanted} /> : null}
        </div>
      ) : null}
    </div>
  );
}
