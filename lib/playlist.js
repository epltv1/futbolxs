
const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedChannels = null;
let cachedAt = 0;
let pendingFetch = null;

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "") || "channel";
}

function parseM3U(text) {
  const lines = String(text).replace(/^\uFEFF/, "").split(/\r?\n/);
  const channels = [];
  const slugCounts = new Map();
  let pending = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF:")) {
      const comma = line.indexOf(",");
      const metadata = comma >= 0 ? line.slice(0, comma) : line;
      const displayName = comma >= 0 ? line.slice(comma + 1).trim() : "";
      const tvgName = metadata.match(/(?:^|\s)tvg-name="([^"]*)"/i)?.[1]?.trim();

      pending = {
        name: tvgName || displayName || "Unnamed channel"
      };
      continue;
    }

    if (line.startsWith("#")) continue;

    if (pending && /^https?:\/\//i.test(line)) {
      const base = slugify(pending.name);
      const count = (slugCounts.get(base) || 0) + 1;
      slugCounts.set(base, count);

      const slug = count === 1 ? base : `${base}-${count}`;
      channels.push({ slug, name: pending.name, url: line });
    }

    pending = null;
  }

  return channels;
}

async function getChannels(forceRefresh = false) {
  if (!forceRefresh && cachedChannels && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedChannels;
  }

  if (!forceRefresh && pendingFetch) return pendingFetch;

  pendingFetch = (async () => {
    const playlistUrl = process.env.REBEL_PLAYLIST_URL;

    if (!playlistUrl) {
      throw new Error("REBEL_PLAYLIST_URL environment variable is not configured.");
    }

    const response = await fetch(playlistUrl, {
      headers: {
        Accept: "application/vnd.apple.mpegurl, audio/x-mpegurl, text/plain, */*"
      },
      signal: AbortSignal.timeout(12000),
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Playlist request failed (${response.status}).`);
    }

    const text = await response.text();

    if (!text.trim() || (!text.includes("#EXTINF") && !text.includes("#EXTM3U"))) {
      throw new Error("The playlist response was empty or was not a valid M3U playlist.");
    }

    const parsed = parseM3U(text);

    if (!parsed.length) {
      throw new Error("No HTTP channel entries were found in the M3U playlist.");
    }

    cachedChannels = parsed;
    cachedAt = Date.now();

    return parsed;
  })();

  try {
    return await pendingFetch;
  } finally {
    pendingFetch = null;
  }
}

export { getChannels };
