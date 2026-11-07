import { useEffect, useRef, useState, type ReactNode } from "react";
import { RefreshCw, Shield, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatSyncedAt } from "../components/header.tsx";

interface CatalogStatus {
  status: "idle" | "running" | "done";
  finishedAt: string | null;
  remaining: number;
  count: number | null;
  locked: boolean;
}

interface ProfileFailure {
  name: string;
  reason: string;
}

interface ProfileStatus {
  status: "idle" | "running" | "done";
  total: number;
  index: number;
  updated: number;
  private: number;
  missing: number;
  failed: number;
  current: string | null;
  last: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  locked: boolean;
  failures: ProfileFailure[];
}

type Busy = "catalog" | "profiles" | null;

export function AdminPage() {
  const [catalog, setCatalog] = useState<CatalogStatus | null>(null);
  const [profiles, setProfiles] = useState<ProfileStatus | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    document.title = "Admin · KCC Trader";
    return () => {
      document.title = "KCC Trader";
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin", { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401 || response.status === 403) {
          setDenied(true);
          return;
        }
        if (!response.ok) throw new Error("Could not load admin status");
        const body = (await response.json()) as { catalog: CatalogStatus; profiles: ProfileStatus };
        setCatalog({ ...body.catalog, locked: false, status: body.catalog.status });
        setProfiles(body.profiles);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Could not load admin status");
      });
    return () => controller.abort();
  }, []);

  async function runCatalog(restart: boolean) {
    setBusy("catalog");
    setError(null);
    try {
      let force = restart;
      let owner = "";
      for (;;) {
        const params = new URLSearchParams();
        if (force) params.set("restart", "");
        if (owner) params.set("owner", owner);
        const query = params.toString();
        const response = await fetch(query ? `/api/admin/catalog?${query}` : "/api/admin/catalog", { method: "POST" });
        const body = (await response.json()) as CatalogStatus & { error?: string; syncedAt?: string; count?: number; owner?: string };
        if (!response.ok) throw new Error(body.error ?? "Catalog sync failed");
        if (body.owner) owner = body.owner;
        if (!alive.current) break;
        if (body.status === "done") {
          setCatalog({
            status: "done",
            finishedAt: body.syncedAt ?? null,
            remaining: 0,
            count: body.count ?? null,
            locked: false,
          });
          break;
        }
        setCatalog((current) => ({
          status: body.status,
          finishedAt: body.finishedAt ?? current?.finishedAt ?? null,
          remaining: body.remaining ?? 0,
          count: body.count ?? current?.count ?? null,
          locked: Boolean(body.locked),
        }));
        if (!alive.current || body.status !== "running") break;
        if (body.locked) {
          await pause(1500);
          if (!alive.current) break;
          continue;
        }
        force = false;
      }
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error ? cause.message : "Catalog sync failed");
    } finally {
      if (alive.current) setBusy(null);
    }
  }

  async function runProfiles(restart: boolean) {
    setBusy("profiles");
    setError(null);
    if (restart) {
      setProfiles((current) =>
        current
          ? { ...current, status: "running", index: 0, current: null, last: null, locked: false, failures: [] }
          : current,
      );
    }
    try {
      let force = restart;
      for (;;) {
        const response = await fetch(force ? "/api/admin/profiles?restart" : "/api/admin/profiles", { method: "POST" });
        const body = (await response.json()) as ProfileStatus & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "Profile sync failed");
        if (!alive.current) break;
        setProfiles(body);
        if (body.status !== "running") break;
        if (body.locked) {
          await pause(1500);
          if (!alive.current) break;
          continue;
        }
        force = false;
      }
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error ? cause.message : "Profile sync failed");
    } finally {
      if (alive.current) setBusy(null);
    }
  }

  if (denied) {
    return (
      <section className="mx-auto grid w-full max-w-3xl gap-3 rounded-[1.75rem] border border-white/10 bg-white/[0.03] px-5 py-8 text-center md:px-8">
        <h1 className="font-display text-2xl font-extrabold">Admin</h1>
        <p className="text-sm text-white/65">This page is only available to the site admin.</p>
      </section>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <section className="flex items-center gap-4 rounded-[1.75rem] border border-white/10 bg-[radial-gradient(110%_130%_at_0%_0%,rgba(253,230,176,0.16),transparent_55%),linear-gradient(160deg,#1c1833,#141224)] px-5 py-4 md:px-8 md:py-5">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-200/15 text-amber-200">
          <Shield className="size-5" />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-2xl leading-tight font-extrabold tracking-tight md:text-3xl">Admin</h1>
          <p className="text-sm text-white/65">Force a catalog sync, or refresh every trader's profile and collection.</p>
        </div>
      </section>

      {error ? (
        <p className="rounded-2xl border border-rose-200/30 bg-rose-200/10 px-4 py-3 text-sm text-rose-100">{error}</p>
      ) : null}

      <Panel
        icon={RefreshCw}
        title="Catalog"
        body={catalogBody(catalog)}
        action={
          <SyncButtons
            busy={busy === "catalog"}
            disabled={catalog === null || (busy !== null && busy !== "catalog")}
            idleLabel="Resync catalog"
            running={catalog?.status === "running"}
            onContinue={() => void runCatalog(false)}
            onRestart={() => void runCatalog(true)}
          />
        }
      />

      <Panel
        icon={Users}
        title="Profiles and collections"
        body="Fetches each trader's public KCC profile and collection. Leaderboard numbers update, and their lists sync the same way they would from the sync button. Keep this page open until it finishes."
        action={
          <SyncButtons
            busy={busy === "profiles"}
            disabled={profiles === null || (busy !== null && busy !== "profiles")}
            idleLabel="Resync everyone"
            running={profiles?.status === "running"}
            onContinue={() => void runProfiles(false)}
            onRestart={() => void runProfiles(true)}
          />
        }
      >
        {profiles && profiles.total > 0 ? (
          <div className="grid gap-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-amber-200 transition-[width]"
                style={{ width: `${Math.min(100, (profiles.index / profiles.total) * 100)}%` }}
              />
            </div>
            <p className="text-sm text-white/70">{profileLine(profiles, busy === "profiles")}</p>
            {profiles.failures.length > 0 ? (
              <ul className="grid gap-1 text-sm text-rose-100/90">
                {profiles.failures.map((failure) => (
                  <li key={`${failure.name}-${failure.reason}`}>
                    {failure.name}: {failure.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

function Panel({
  icon: Icon,
  title,
  body,
  action,
  children,
}: {
  icon: typeof RefreshCw;
  title: string;
  body: string;
  action: ReactNode;
  children?: ReactNode;
}) {
  return (
    <article className="grid gap-4 rounded-[1.75rem] border border-white/10 bg-white/[0.03] px-5 py-5 md:px-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/[0.06] text-white/80">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold">{title}</h2>
          {body ? <p className="mt-1 text-sm text-white/65">{body}</p> : <Skeleton className="mt-2 h-4 w-48" />}
        </div>
      </div>
      {children}
      <div className="flex flex-wrap gap-2">{action}</div>
    </article>
  );
}

function SyncButtons({
  busy,
  disabled,
  idleLabel,
  running,
  onContinue,
  onRestart,
}: {
  busy: boolean;
  disabled: boolean;
  idleLabel: string;
  running: boolean;
  onContinue: () => void;
  onRestart: () => void;
}) {
  if (busy) {
    return (
      <Button className="rounded-full" disabled>
        <RefreshCw className="animate-spin" />
        Syncing…
      </Button>
    );
  }
  if (running) {
    return (
      <>
        <Button className="rounded-full" disabled={disabled} onClick={onContinue}>
          Continue
        </Button>
        <Button variant="outline" className="rounded-full" disabled={disabled} onClick={onRestart}>
          Start over
        </Button>
      </>
    );
  }
  return (
    <Button className="rounded-full" disabled={disabled} onClick={onRestart}>
      {idleLabel}
    </Button>
  );
}

function catalogBody(catalog: CatalogStatus | null): string {
  if (!catalog) return "";
  if (catalog.status === "running") return catalogLine(catalog, false);
  if (catalog.finishedAt) {
    const count = catalog.count === null ? "" : ` · ${catalog.count.toLocaleString()} cards`;
    return `Last synced ${formatSyncedAt(catalog.finishedAt)}${count}.`;
  }
  return "The catalog has not been synced yet.";
}

function catalogLine(catalog: CatalogStatus, active: boolean): string {
  if (catalog.locked) return "Waiting for the current catalog sync to finish.";
  if (catalog.remaining > 0) {
    const noun = catalog.remaining === 1 ? "character" : "characters";
    return active
      ? `Syncing the catalog · ${catalog.remaining.toLocaleString()} ${noun} left.`
      : `A catalog sync is in progress · ${catalog.remaining.toLocaleString()} ${noun} left.`;
  }
  return active ? "Syncing the catalog." : "A catalog sync is in progress.";
}

function profileLine(profiles: ProfileStatus, active: boolean): string {
  const done = `${profiles.index.toLocaleString()} of ${profiles.total.toLocaleString()}`;
  if (profiles.status === "done") return `${done}. ${profileSummary(profiles)}.`;
  if (profiles.locked) return `${done}. Waiting for the current profile sync to finish.`;
  if (active) {
    const who = profiles.last ? `Last finished: ${profiles.last}.` : "Starting.";
    const next = profiles.current ? ` Syncing ${profiles.current}.` : "";
    return `${done}. ${who}${next}`;
  }
  const next = profiles.current ? ` Next is ${profiles.current}.` : "";
  return `${done} so far.${next} ${profileSummary(profiles)}.`;
}

function profileSummary(profiles: ProfileStatus): string {
  const parts = [`${profiles.updated.toLocaleString()} updated`];
  if (profiles.private > 0) parts.push(`${profiles.private.toLocaleString()} private`);
  if (profiles.missing > 0) parts.push(`${profiles.missing.toLocaleString()} without a KCC profile`);
  if (profiles.failed > 0) parts.push(`${profiles.failed.toLocaleString()} failed`);
  return parts.join(", ");
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
