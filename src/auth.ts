const COOKIE = "kcc_session";
const STATE_COOKIE = "kcc_oauth_state";
const SESSION_MS = 14 * 24 * 60 * 60 * 1000;

export interface AuthEnv {
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
  SESSION_SECRET?: string;
}

export interface SessionProfile {
  id: string;
  name: string;
  discordUsername: string;
  level: number;
  publicCollection: boolean;
  cards: number;
  sss: number;
}

export interface SessionUser {
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string;
  profile: SessionProfile | null;
}

interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
}

interface KccProfileResponse {
  profile?: {
    id?: string;
    name?: string;
    discordUsername?: string;
    level?: number;
    publicCollection?: boolean;
    stats?: { cards?: number; sss?: number };
  };
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function cookieSuffix(request: Request, maxAge: number): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function seal(user: SessionUser, secret: string): Promise<string> {
  const payload = new TextEncoder().encode(JSON.stringify({ ...user, exp: Date.now() + SESSION_MS }));
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", await hmacKey(secret), payload),
  );
  return `${bytesToBase64Url(payload)}.${bytesToBase64Url(signature)}`;
}

async function open(token: string, secret: string): Promise<SessionUser | null> {
  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) return null;
  const payload = base64UrlToBytes(payloadPart);
  const signature = base64UrlToBytes(signaturePart);
  const valid = await crypto.subtle.verify("HMAC", await hmacKey(secret), signature, payload);
  if (!valid) return null;
  const parsed = JSON.parse(new TextDecoder().decode(payload)) as SessionUser & { exp?: number };
  if (!parsed.exp || parsed.exp < Date.now()) return null;
  return {
    id: parsed.id,
    username: parsed.username,
    globalName: parsed.globalName,
    avatarUrl: parsed.avatarUrl,
    profile: parsed.profile,
  };
}

function callbackUrl(request: Request): string {
  return `${new URL(request.url).origin}/auth/discord/callback`;
}

function configured(env: AuthEnv): env is AuthEnv & {
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  SESSION_SECRET: string;
} {
  return Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET && env.SESSION_SECRET);
}

function redirect(location: string, cookies: string[] = []): Response {
  const headers = new Headers({ Location: location });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}

export async function beginDiscordLogin(request: Request, env: AuthEnv): Promise<Response> {
  if (!configured(env)) return redirect("/?error=discord_config");

  const state = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(24)));
  const authorize = new URL("https://discord.com/oauth2/authorize");
  authorize.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("redirect_uri", callbackUrl(request));
  authorize.searchParams.set("scope", "identify");
  authorize.searchParams.set("state", state);
  return redirect(authorize.toString(), [`${STATE_COOKIE}=${state}; ${cookieSuffix(request, 600)}`]);
}

async function discordUser(code: string, request: Request, env: AuthEnv & {
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
}): Promise<DiscordUser> {
  const body = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    client_secret: env.DISCORD_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: callbackUrl(request),
  });
  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!tokenResponse.ok) throw new Error("Discord token exchange failed");
  const token = (await tokenResponse.json()) as { access_token?: string };
  if (!token.access_token) throw new Error("Discord token exchange failed");

  const userResponse = await fetch("https://discord.com/api/users/@me", {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  if (!userResponse.ok) throw new Error("Discord profile lookup failed");
  return (await userResponse.json()) as DiscordUser;
}

async function kccProfile(discordId: string): Promise<SessionProfile | null> {
  const response = await fetch(
    `https://koi-card-collector.com/api/community/profiles/${discordId}`,
    { headers: { "user-agent": "kcc-trader" } },
  );
  if (!response.ok) return null;
  const data = (await response.json()) as KccProfileResponse;
  const profile = data.profile;
  if (!profile?.id || !profile.name) return null;
  return {
    id: profile.id,
    name: profile.name,
    discordUsername: profile.discordUsername ?? "",
    level: profile.level ?? 0,
    publicCollection: profile.publicCollection ?? false,
    cards: profile.stats?.cards ?? 0,
    sss: profile.stats?.sss ?? 0,
  };
}

function avatarUrl(user: DiscordUser): string {
  if (user.avatar) return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
  const index = Number((BigInt(user.id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

export async function finishDiscordLogin(
  request: Request,
  env: AuthEnv,
  onSignIn?: (user: SessionUser) => Promise<unknown>,
): Promise<Response> {
  if (!configured(env)) return redirect("/?error=discord_config");
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const expected = readCookie(request, STATE_COOKIE);
  const clearState = `${STATE_COOKIE}=; ${cookieSuffix(request, 0)}`;
  if (!state || !code || state !== expected || url.searchParams.get("error")) {
    return redirect("/?error=discord_denied", [clearState]);
  }

  try {
    const discord = await discordUser(code, request, env);
    const user: SessionUser = {
      id: discord.id,
      username: discord.username,
      globalName: discord.global_name ?? null,
      avatarUrl: avatarUrl(discord),
      profile: await kccProfile(discord.id),
    };
    await onSignIn?.(user).catch(() => undefined);
    const session = await seal(user, env.SESSION_SECRET);
    return redirect("/", [
      `${COOKIE}=${session}; ${cookieSuffix(request, SESSION_MS / 1000)}`,
      clearState,
    ]);
  } catch {
    return redirect("/?error=discord_failed", [clearState]);
  }
}

export function logout(request: Request): Response {
  return redirect("/", [`${COOKIE}=; ${cookieSuffix(request, 0)}`]);
}

export async function readSession(request: Request, env: AuthEnv): Promise<SessionUser | null> {
  if (!env.SESSION_SECRET) return null;
  const token = readCookie(request, COOKIE);
  if (!token) return null;
  try {
    return await open(token, env.SESSION_SECRET);
  } catch {
    return null;
  }
}
