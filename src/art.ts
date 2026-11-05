const ORIGIN = "https://koi-card-collector.com";

export interface ArtEnv {
  CARDS: KVNamespace;
}

function contentType(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes, 0, Math.min(12, bytes.byteLength));
  if (view[0] === 0x89 && view[1] === 0x50) return "image/png";
  if (view[0] === 0xff && view[1] === 0xd8) return "image/jpeg";
  if (view[0] === 0x52 && view[1] === 0x49) return "image/webp";
  return "application/octet-stream";
}

function imageResponse(bytes: ArrayBuffer): Response {
  return new Response(bytes, {
    headers: {
      "content-type": contentType(bytes),
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}

async function mapPool<T>(items: T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      await task(items[index]);
    }
  }
  const workers = Math.min(limit, items.length);
  if (workers === 0) return;
  await Promise.all(Array.from({ length: workers }, () => worker()));
}

async function storedArtIds(env: ArtEnv): Promise<Set<string>> {
  const ids = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await env.CARDS.list({ prefix: "art:", cursor });
    for (const key of page.keys) ids.add(key.name.slice("art:".length));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return ids;
}

export async function cacheArt(env: ArtEnv, ids: Iterable<string>): Promise<void> {
  const stored = await storedArtIds(env);
  const missing = [...new Set(ids)].filter((id) => /^[0-9a-f-]{36}$/i.test(id) && !stored.has(id));

  await mapPool(missing, 6, async (id) => {
    const upstream = await fetch(`${ORIGIN}/api/community/art/${id}?w=300`, {
      headers: { "user-agent": "kcc-trader" },
    });
    if (!upstream.ok) throw new Error(`Art ${id} failed: ${upstream.status}`);
    await env.CARDS.put(`art:${id}`, await upstream.arrayBuffer());
  });
}

export async function serveArt(env: ArtEnv, id: string): Promise<Response> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 404 });
  const cached = await env.CARDS.get(`art:${id}`, { type: "arrayBuffer" });
  if (!cached) return new Response(null, { status: 404 });
  return imageResponse(cached);
}
