import { useEffect, useState, type ReactNode } from "react";
import { Check, Info, Link2, X, type LucideIcon } from "lucide-react";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { cardKey, type Card } from "../../types.ts";
import { profileUrl, type Page } from "../model.ts";
import { CardFace } from "./cards.tsx";
import { PrivacyPage } from "../pages/PrivacyPage.tsx";
import { TermsPage } from "../pages/TermsPage.tsx";

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

export function LegalDialog({
  open,
  accepting,
  error,
  onAccept,
  onOpenPage,
}: {
  open: boolean;
  accepting: boolean;
  error: string | null;
  onAccept: () => void;
  onOpenPage: (page: Page, href: string) => void;
}) {
  const [agreed, setAgreed] = useState(false);
  const [document, setDocument] = useState<"terms" | "privacy" | null>(null);
  useEffect(() => {
    if (!open) {
      setAgreed(false);
      setDocument(null);
    }
  }, [open]);

  return (
    <>
      <Dialog.Root open={open}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
          <Dialog.Content
            onEscapeKeyDown={(event) => event.preventDefault()}
            onPointerDownOutside={(event) => event.preventDefault()}
            className="fixed inset-x-4 top-1/2 z-50 w-auto max-w-md -translate-y-1/2 rounded-3xl border border-white/10 bg-[#1a1528] p-5 text-white shadow-lg outline-none sm:inset-x-auto sm:left-1/2 sm:w-[min(28rem,calc(100%-2rem))] sm:-translate-x-1/2 sm:p-6 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          >
            <Dialog.Title className="font-display text-xl font-bold">Before you continue</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-relaxed text-white/70">
              Please review the{" "}
              <button
                type="button"
                className="font-semibold text-white underline decoration-white/30 underline-offset-2 hover:decoration-white"
                onClick={() => setDocument("terms")}
              >
                terms of service
              </button>{" "}
              and{" "}
              <button
                type="button"
                className="font-semibold text-white underline decoration-white/30 underline-offset-2 hover:decoration-white"
                onClick={() => setDocument("privacy")}
              >
                privacy policy
              </button>
              . Continuing means you agree to both.
            </Dialog.Description>
            <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3.5 text-sm leading-snug text-white/80 sm:mt-5">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
                disabled={accepting}
                className="size-5 shrink-0 rounded border-white/30 bg-transparent accent-violet-300"
              />
              <span className="min-w-0">I agree to the terms and privacy policy.</span>
            </label>
            {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
            <div className="mt-4 sm:mt-5 sm:flex sm:justify-end">
              <Button className="w-full rounded-full sm:w-auto" disabled={!agreed || accepting} onClick={onAccept}>
                {accepting ? "Saving…" : "Continue"}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={document !== null} onOpenChange={(next) => { if (!next) setDocument(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/60 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 top-[max(2.5rem,env(safe-area-inset-top))] z-[70] flex flex-col overflow-hidden rounded-t-3xl border border-white/10 border-b-0 bg-[#141224] text-white shadow-lg outline-none sm:inset-auto sm:top-1/2 sm:left-1/2 sm:bottom-auto sm:max-h-[min(44rem,calc(100%-2rem))] sm:w-[min(40rem,calc(100%-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:border-b data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-4 sm:data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-bottom-4 sm:data-closed:zoom-out-95">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <Dialog.Title className="truncate font-display text-lg font-bold">
                  {document === "privacy" ? "Privacy policy" : "Terms of service"}
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 text-xs text-white/45">
                  Effective November 9, 2026
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close"
                  className="shrink-0 rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                >
                  <X />
                </Button>
              </Dialog.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-4">
              {document === "privacy" ? (
                <PrivacyPage
                  embedded
                  onOpen={(page, href) => {
                    if (page === "terms" || page === "privacy") setDocument(page);
                    else {
                      setDocument(null);
                      onOpenPage(page, href);
                    }
                  }}
                />
              ) : document === "terms" ? (
                <TermsPage
                  embedded
                  onOpen={(page, href) => {
                    if (page === "terms" || page === "privacy") setDocument(page);
                    else {
                      setDocument(null);
                      onOpenPage(page, href);
                    }
                  }}
                />
              ) : null}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

export function WelcomeDialog({
  open,
  onDismiss,
  onConfirm,
  profileHref,
}: {
  open: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
  profileHref: string;
}) {
  const [awaitingChange, setAwaitingChange] = useState(false);
  useEffect(() => {
    if (!open) setAwaitingChange(false);
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onDismiss(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/10 bg-[#1a1528] p-6 text-white shadow-lg outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
          <Dialog.Title className="font-display text-xl font-bold">Make your KCC profile public</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-white/70">
            KCC Trader can't read a private profile. Open your profile, choose Edit profile, and turn on “<strong className="font-bold text-white">Show my collection to other players</strong>”.
          </Dialog.Description>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="ghost" className="rounded-full">Not now</Button>
            </Dialog.Close>
            {awaitingChange ? (
              <Button className="rounded-full" onClick={onConfirm}>I've made it public</Button>
            ) : (
              <Button asChild className="rounded-full">
                <a
                  href={profileHref}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setAwaitingChange(true)}
                >
                  Open your KCC profile
                </a>
              </Button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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

export function StatPill({ value, label, className }: { value: number; label: string; className?: string }) {
  return (
    <div className={cn("flex items-baseline gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1", className)}>
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
