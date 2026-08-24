export interface ParsedTitle {
  /** e.g. "1080p" */
  resolution?: string;
  season?: number;
  episode?: number;
  /** Rough guess of the series title, used later by the anime tracker */
  animeTitle?: string;
}

const RESOLUTION_RE = /\b(2160|1440|1080|720|576|480)p\b/i;
const SEASON_EPISODE_RE = /\bS(\d{1,2})\s*[-_. ]?\s*E(\d{1,3})\b/i;
const CJK_EPISODE_RE = /第\s*(\d{1,4})\s*(?:话|話|集|话|話)/;
const EP_PREFIX_RE = /\bEP?\.?\s*(\d{1,3})\b/i;
/** Fansub style: "Title - 01 [1080p]" / "Title 01 [720p]" */
const TRAILING_EPISODE_RE = /(?:\s[-–]\s|\s)(\d{1,3})(?:v\d+)?\s*(?:\[[^\]]*\]|$)/;

/**
 * Best-effort parse of a release title. Never throws; every field is optional.
 */
export function parseTorrentTitle(title: string): ParsedTitle {
  const result: ParsedTitle = {};
  if (!title) return result;

  const res = RESOLUTION_RE.exec(title);
  if (res) result.resolution = `${res[1]}p`;

  const se = SEASON_EPISODE_RE.exec(title);
  if (se) {
    result.season = parseInt(se[1], 10);
    result.episode = parseInt(se[2], 10);
  } else {
    const cjk = CJK_EPISODE_RE.exec(title);
    const epPrefix = EP_PREFIX_RE.exec(title);
    if (cjk) {
      result.episode = parseInt(cjk[1], 10);
    } else if (epPrefix) {
      result.episode = parseInt(epPrefix[1], 10);
    } else {
      const trailing = TRAILING_EPISODE_RE.exec(title);
      if (trailing) {
        const n = parseInt(trailing[1], 10);
        // Guard against years and resolutions slipping in
        if (n > 0 && n < 2000 && n !== parseInt(res?.[1] ?? "", 10)) {
          result.episode = n;
        }
      }
    }
  }

  result.animeTitle = guessSeriesTitle(title);
  return result;
}

/** Rough series-title guess: strip group tags in brackets, cut at the episode marker. */
function guessSeriesTitle(title: string): string | undefined {
  let text = title
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/_{1,}/g, " ")
    .replace(/\.(?=[A-Za-z0-9])/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  const cutRes = SEASON_EPISODE_RE.exec(text);
  if (cutRes) text = text.slice(0, cutRes.index);
  else {
    const cutters = [CJK_EPISODE_RE.exec(text), EP_PREFIX_RE.exec(text), TRAILING_EPISODE_RE.exec(text)];
    const indexes = cutters
      .filter((m): m is RegExpExecArray => !!m)
      .map((m) => m.index);
    if (indexes.length > 0) text = text.slice(0, Math.min(...indexes));
  }

  text = text.replace(/[-–—\s]+$/, "").replace(/^[-–—\s]+/, "").trim();
  if (!text || text.length < 2) return undefined;
  return text;
}

/** Tokens that mark a bracket tag as quality info rather than a fansub group */
const NOT_A_GROUP_RE =
  /\b(1080|720|2160|480|HEVC|AVC|x26[45]|h26[45]|AAC|FLAC|AC3|10bit|8bit|WEB|BD|DVD|GB|MB|BIG5|CHS|CHT|v\d)\b/i;

/**
 * Extract the release subgroup from a fansub-style title, e.g.
 * "[喵萌奶茶屋&LoliHouse] 欺诈游戏 - 20 [...]" → "喵萌奶茶屋&LoliHouse".
 */
export function extractSubgroup(title: string): string | undefined {
  const match = /^\s*[[({]([^\])}]{1,50})[\])}]/.exec(title);
  if (!match) return undefined;
  const name = match[1].trim();
  if (!name || NOT_A_GROUP_RE.test(name)) return undefined;
  return name;
}

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Decode a base32 string (used by some magnet links) into a hex string. */
function base32ToHex(input: string): string | null {
  const clean = input.toUpperCase().replace(/=+$/, "");
  let bits = "";
  for (const ch of clean) {
    const v = BASE32_ALPHABET.indexOf(ch);
    if (v === -1) return null;
    bits += v.toString(2).padStart(5, "0");
  }
  if (bits.length % 8 !== 0) return null;
  let hex = "";
  for (let i = 0; i < bits.length; i += 8) {
    hex += parseInt(bits.slice(i, i + 8), 2).toString(16).padStart(2, "0");
  }
  return hex;
}

const BTIH_RE = /btih:([0-9a-fA-F]{40}|[A-Za-z2-7]{32})/i;

/**
 * Extract a 40 char lowercase hex info hash from a magnet URI or any text
 * containing one. Returns null when none is found.
 */
export function extractInfoHash(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = BTIH_RE.exec(text);
  if (!match) return null;
  const raw = match[1];
  if (/^[0-9a-fA-F]{40}$/.test(raw)) return raw.toLowerCase();
  return base32ToHex(raw);
}

const MAGNET_RE = /magnet:\?[^"'<>\s]+/i;

/** Find the first magnet URI inside arbitrary text (link, description...). */
export function extractMagnet(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = MAGNET_RE.exec(text);
  return match ? match[0] : null;
}

/** Build a minimal magnet URI from a hash and a title. */
export function buildMagnet(infoHash: string, title?: string | null): string {
  const dn = title ? `&dn=${encodeURIComponent(title)}` : "";
  return `magnet:?xt=urn:btih:${infoHash}${dn}`;
}
