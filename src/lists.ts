export type ListName = "forTrade" | "wishlist";

export interface Lists {
  forTrade: string[];
  wishlist: string[];
}

interface StoredLists extends Partial<Lists> {
  wanted?: string[];
}

interface ListEnv {
  CARDS: KVNamespace;
}

const KEY_PATTERN =
  /^(?:characters|events):[0-9a-f-]{36}:(?:[0-9a-f-]{36})?:(?:Common|B|A|S|SS|SSS)$/i;
const MAX_PER_LIST = 400;

function emptyLists(): Lists {
  return { forTrade: [], wishlist: [] };
}

function asKeys(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function storageKey(userId: string): string {
  return `lists:${userId}`;
}

export async function readLists(env: ListEnv, userId: string): Promise<Lists> {
  const raw = await env.CARDS.get(storageKey(userId));
  if (!raw) return emptyLists();
  const parsed = JSON.parse(raw) as StoredLists;
  return {
    forTrade: asKeys(parsed.forTrade),
    wishlist: asKeys(parsed.wishlist).length > 0 ? asKeys(parsed.wishlist) : asKeys(parsed.wanted),
  };
}

export async function changeList(
  env: ListEnv,
  userId: string,
  list: ListName,
  key: string,
  present: boolean,
): Promise<Lists> {
  if (!KEY_PATTERN.test(key)) throw new Error("Unknown card");
  const lists = await readLists(env, userId);
  const current = new Set(lists[list]);
  if (present) {
    if (!current.has(key) && current.size >= MAX_PER_LIST) {
      throw new Error("That list is full");
    }
    current.add(key);
  } else {
    current.delete(key);
  }
  const next = [...current];
  if (present) {
    const without = next.filter((item) => item !== key);
    lists[list] = [key, ...without];
  } else {
    lists[list] = next;
  }
  await env.CARDS.put(storageKey(userId), JSON.stringify(lists));
  return lists;
}
