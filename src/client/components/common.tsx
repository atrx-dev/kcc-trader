import { useState, type ReactNode } from "react";
import { Check, Info, Link2, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { cardKey, type Card } from "../../types.ts";
import { profileUrl } from "../model.ts";
import { CardFace } from "./cards.tsx";

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="grid place-items-center gap-3 rounded-3xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-white/[0.06]">
        <Icon className="size-6 text-white/70" />
      </span>
      <p className="font-display text-xl font-bold">{title}</p>
      <p className="max-w-sm text-sm text-white/60">{children}</p>
      {action}
    </div>
  );
}

export function Banner({
  children,
  tone = "error",
  onDismiss,
}: {
  children: ReactNode;
  tone?: "error" | "info";
  onDismiss?: () => void;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm",
        tone === "error"
          ? "border-destructive/30 bg-destructive/10 text-red-200"
          : "border-sky-300/20 bg-sky-300/[0.07] text-sky-100",
      )}
    >
      {tone === "info" ? <Info className="mt-0.5 size-4 shrink-0 text-sky-300" /> : null}
      <p className="flex-1">{children}</p>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-my-1 -mr-2 rounded-full p-1 text-current/60 transition-colors outline-none hover:bg-white/10 hover:text-current focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

export function GridSkeleton() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-x-4 gap-y-[22px]">
      {Array.from({ length: 10 }, (_, index) => (
        <div key={index} className="grid gap-2">
          <Skeleton className="aspect-[2/3] rounded-xl bg-white/[0.06]" />
          <Skeleton className="h-[34px] rounded-full bg-white/[0.05]" />
        </div>
      ))}
    </div>
  );
}

export function SectionHeading({ title, meta }: { title: string; meta?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
      {meta ? <p className="text-sm text-white/55">{meta}</p> : null}
    </div>
  );
}

export function Showcase({ cards }: { cards: Card[] }) {
  if (cards.length < 3) return null;
  const placements = [
    "left-0 top-10 -rotate-[10deg]",
    "left-[118px] top-0 z-10 rotate-[1deg]",
    "left-[236px] top-12 rotate-[11deg]",
  ];
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute right-10 bottom-3 z-20 hidden h-[330px] w-[416px] origin-bottom-right scale-[0.7] lg:block"
    >
      {cards.slice(0, 3).map((card, index) => (
        <div
          key={cardKey(card)}
          className={cn("absolute w-[180px] drop-shadow-[0_24px_40px_rgba(0,0,0,0.55)]", placements[index])}
        >
          <CardFace card={card} />
        </div>
      ))}
    </div>
  );
}

export function StatPill({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">
      <dt className="sr-only">{label}</dt>
      <dd className="font-display text-sm font-bold tabular-nums">{value.toLocaleString()}</dd>
      <span aria-hidden="true" className="text-xs text-white/60">
        {label}
      </span>
    </div>
  );
}

export function copyWithSelection(text: string): boolean {
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  field.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
  }
}

export function ShareListsButton({ userId, className }: { userId: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = profileUrl(userId);
    const ok = await navigator.clipboard.writeText(url).then(
      () => true,
      () => copyWithSelection(url),
    );
    if (!ok) {
      window.prompt("Copy this link to share your lists:", url);
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" size="sm" className={cn("rounded-full", className)} onClick={share}>
          {copied ? <Check /> : <Link2 />}
          {copied ? "Link copied" : "Share lists"}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Copy a link to a public page with your For trade and Wishlist</TooltipContent>
    </Tooltip>
  );
}
