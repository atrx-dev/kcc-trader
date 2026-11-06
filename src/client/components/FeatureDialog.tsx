import { useEffect, useState } from "react";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { type FeatureNote } from "../features.ts";

export function FeatureDialog({
  open,
  notes,
  onDismiss,
  onDisable,
}: {
  open: boolean;
  notes: FeatureNote[];
  onDismiss: () => void;
  onDisable: () => void;
}) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  const note = notes[Math.min(index, Math.max(notes.length - 1, 0))];
  if (!note) return null;
  const several = notes.length > 1;
  const last = index >= notes.length - 1;

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onDismiss(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex h-[min(32rem,calc(100dvh-2rem))] w-[min(36rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#1a1528] text-white shadow-lg outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
          {note.image ? <img src={note.image} alt="" className="h-48 w-full shrink-0 object-cover" /> : null}
          <div className="flex min-h-0 flex-1 flex-col p-6">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <p className="text-xs font-semibold tracking-wider text-amber-200/80 uppercase">What's new</p>
              <Dialog.Title className="mt-1 font-display text-xl font-bold">{note.title}</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-white/70">{note.body}</Dialog.Description>
            </div>
            <div className="mt-5 flex shrink-0 items-center justify-between gap-2">
              <p className="text-xs text-white/45 tabular-nums">{several ? `${index + 1} of ${notes.length}` : null}</p>
              <div className="flex gap-2">
                {several ? (
                  <Button
                    variant="ghost"
                    className="rounded-full"
                    disabled={index === 0}
                    onClick={() => setIndex((current) => current - 1)}
                  >
                    Back
                  </Button>
                ) : null}
                {last ? (
                  <Button className="rounded-full" onClick={onDismiss}>Got it</Button>
                ) : (
                  <Button className="rounded-full" onClick={() => setIndex((current) => current + 1)}>Next</Button>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onDisable}
              className="mt-4 shrink-0 self-start text-xs text-white/45 underline decoration-white/20 underline-offset-2 outline-none hover:text-white/70 hover:decoration-white/50 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Don't show what's new
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
