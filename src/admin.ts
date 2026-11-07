import { recordCollection, syncLists, type CollectionStats } from "./lists.ts";
import { isSpare, ownsCard, readOwned, type OwnedResponse, type SyncedProfile } from "./owned.ts";
import { addSsArtwork, readCatalog } from "./sync.ts";
import { cardKey } from "./types.ts";

/** Discord ids allowed to open the admin panel. */
const ADMINS = new Set(["204699700316602369"]);

const JOB_KEY = "profile-sync";
const LOCK_KEY = "profile-sync-lock";
const LOCK_MS = 120_000;
const FAILURE_LIMIT = 20;

export function isAdmin(user: { id: string } | null): boolean {
  return user !== null && ADMINS.has(user.id);
}

export interface AdminEnv {
  CARDS: KVNamespace;
  DB: D1Database;
}

export interface ProfileFailure {
  name: string;
  reason: string;
}

export interface ProfileSyncProgress {
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

interface ProfileTrader {
  id: string;
  profileId: string;
  name: string;
}

interface ProfileJob {
  traders: ProfileTrader[];
  index: number;
  updated: number;
  private: number;
  missing: number;
  failed: number;
  startedAt: string;
  finishedAt: string | null;
  last: string | null;
  failures: ProfileFailure[];
}

const IDLE: ProfileSyncProgress = {
  status: "idle",
  total: 0,
  index: 0,
  updated: 0,
  private: 0,
  missing: 0,
  failed: 0,
  current: null,
  last: null,
  startedAt: null,
  finishedAt: null,
  locked: false,
  failures: [],
};

export async function profileSyncStatus(env: AdminEnv): Promise<ProfileSyncProgress> {
  const job = await env.CARDS.get<ProfileJob>(JOB_KEY, "json");
  if (!job) return IDLE;
  return progressOf(job, await lockHeld(env));
}

export async function stepProfileSync(env: AdminEnv, restart: boolean): Promise<ProfileSyncProgress> {
  if (await lockHeld(env)) {
    const job = await env.CARDS.get<ProfileJob>(JOB_KEY, "json");
    return job ? progressOf(job, true) : { ...IDLE, locked: true };
  }
  await env.CARDS.put(LOCK_KEY, String(Date.now()), { expirationTtl: 120 });
  try {
    let job = await env.CARDS.get<ProfileJob>(JOB_KEY, "json");
    if (restart || !job) job = await freshJob(env);
    else if (job.finishedAt) return progressOf(job, false);
    if (job.index >= job.traders.length) {
      job.finishedAt = job.finishedAt ?? new Date().toISOString();
      await env.CARDS.put(JOB_KEY, JSON.stringify(job));
      return progressOf(job, false);
    }
    const trader = job.traders[job.index];
    if (!trader) {
      job.finishedAt = new Date().toISOString();
      await env.CARDS.put(JOB_KEY, JSON.stringify(job));
      return progressOf(job, false);
    }
    try {
      const outcome = await refreshTrader(env, trader);
      job[outcome] += 1;
    } catch (error) {
      job.failed += 1;
      if (job.failures.length < FAILURE_LIMIT) {
        const reason = error instanceof Error ? error.message : "Could not sync this collection";
        job.failures.push({ name: trader.name, reason: reason.slice(0, 180) });
      }
    }
    job.last = trader.name;
    job.index += 1;
    if (job.index >= job.traders.length) job.finishedAt = new Date().toISOString();
    await env.CARDS.put(JOB_KEY, JSON.stringify(job));
    return progressOf(job, false);
  } finally {
    await env.CARDS.delete(LOCK_KEY);
  }
}

async function freshJob(env: AdminEnv): Promise<ProfileJob> {
  const rows = await env.DB.prepare(
    "SELECT id, kcc_id, name FROM traders ORDER BY name COLLATE NOCASE",
  ).all<{ id: string; kcc_id: string | null; name: string }>();
  return {
    traders: rows.results.map((row) => ({
      id: row.id,
      profileId: row.kcc_id || row.id,
      name: row.name,
    })),
    index: 0,
    updated: 0,
    private: 0,
    missing: 0,
    failed: 0,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    last: null,
    failures: [],
  };
}

async function refreshTrader(env: AdminEnv, trader: ProfileTrader): Promise<"updated" | "private" | "missing"> {
  let owned: OwnedResponse;
  try {
    owned = await readOwned(env, trader.profileId, true, true);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("404")) return "missing";
    throw error;
  }
  const profile = owned.profile;
  if (!profile) return "missing";
  const stats = collectionStats(profile);
  await recordCollection(env, trader.id, stats);
  if (!stats) return "private";
  await addSsArtwork(env, owned.artwork);
  await syncCollectionLists(env, trader.id, owned);
  return "updated";
}

function collectionStats(profile: SyncedProfile): CollectionStats | null {
  if (!profile.publicCollection) return null;
  return {
    cards: profile.cards,
    sss: profile.sss,
    level: profile.level,
    collectionValue: profile.collectionValue,
  };
}

async function syncCollectionLists(env: AdminEnv, traderId: string, owned: OwnedResponse): Promise<void> {
  if (!owned.complete || owned.hidden || !owned.profile?.publicCollection) return;
  const duplicates =
    Object.keys(owned.duplicates ?? {}).length > 0
      ? (await readCatalog(env)).cards.map(cardKey).filter((key) => isSpare(owned.duplicates, key))
      : [];
  const previous = owned.previousDuplicates;
  const fresh = previous ? duplicates.filter((key) => !isSpare(previous, key)) : [];
  await syncLists(env, traderId, (key) => ownsCard(owned, key), duplicates, fresh);
}

function progressOf(job: ProfileJob, locked: boolean): ProfileSyncProgress {
  const done = job.finishedAt !== null || job.index >= job.traders.length;
  return {
    status: done ? "done" : "running",
    total: job.traders.length,
    index: job.index,
    updated: job.updated,
    private: job.private,
    missing: job.missing,
    failed: job.failed,
    current: done ? null : (job.traders[job.index]?.name ?? null),
    last: job.last,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    locked,
    failures: job.failures,
  };
}

async function lockHeld(env: AdminEnv): Promise<boolean> {
  const lock = await env.CARDS.get(LOCK_KEY);
  return Boolean(lock && Date.now() - Number(lock) < LOCK_MS);
}
