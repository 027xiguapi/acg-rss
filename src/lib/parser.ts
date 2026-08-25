import { createHash } from "node:crypto";

export interface ParsedTitle {
  /** e.g. "1080p" */
  resolution?: string;
  season?: number;
  episode?: number;
  /** Rough guess of the series title, used later by the bangumi tracker */
  bangumiTitle?: string;
}

const RESOLUTION_RE = /\b(2160|1440|1080|720|576|480)p\b/i;
/** Axis form: "1920x1080" → height 1080 */
const RESOLUTION_AXIS_RE = /\b(?:3840|2560|1920|1280)\s*[x×]\s*(2160|1440|1080|720)\b/i;
const SEASON_EPISODE_RE = /\bS(\d{1,2})\s*[-_. ]?\s*E(\d{1,3})\b/i;
const CJK_EPISODE_RE = /第\s*(\d{1,4})\s*(?:话|話|集|话|話)/;
const EP_PREFIX_RE = /\bEP?\.?\s*(\d{1,3})\b/i;
/** Fansub style: "Title - 01 [1080p]" / "Title 01 [720p]" / "- 20 (ABEMA...)" */
const TRAILING_EPISODE_RE = /(?:\s[-–]\s|\s)(\d{1,3})(?:v\d+)?(?=\s|\[|\(|$)/;
/** Group style: a lone bracketed number like "[20][1080p]" */
const BRACKET_EPISODE_RE = /[\[【](?:第\s*)?(\d{1,3})(?:话|話|集)?[\]】]/;

/**
 * Best-effort parse of a release title. Never throws; every field is optional.
 */
export function parseTorrentTitle(title: string): ParsedTitle {
  const result: ParsedTitle = {};
  if (!title) return result;

  const res = RESOLUTION_RE.exec(title);
  if (res) {
    result.resolution = `${res[1]}p`;
  } else {
    const axis = RESOLUTION_AXIS_RE.exec(title);
    if (axis) result.resolution = `${axis[1]}p`;
  }

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
      const bracket = BRACKET_EPISODE_RE.exec(title);
      const raw = trailing?.[1] ?? bracket?.[1];
      if (raw != null) {
        const n = parseInt(raw, 10);
        // Guard against years and resolutions slipping in
        if (n > 0 && n < 2000 && n !== parseInt(res?.[1] ?? "", 10)) {
          result.episode = n;
        }
      }
    }
  }

  result.bangumiTitle = guessSeriesTitle(title);
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
  const match = /^\s*[\[【({]([^\]】)}]{1,50})[\]】)}]/.exec(title);
  if (!match) return undefined;
  const name = match[1].trim();
  if (!name || NOT_A_GROUP_RE.test(name)) return undefined;
  return name;
}

/** Subtitle languages parsed from the title. */
export interface SubtitleInfo {
  /** Normalized language tags, e.g. ["zh-Hans", "zh-Hant", "ja"] */
  languages: string[];
  /** Subtitle delivery format: embedded (硬字幕) or closed (内封/外挂) */
  format: "embedded" | "closed" | null;
  /** Raw tag as written in the title, e.g. "简繁内封" */
  raw: string | null;
}

/** One language marker: regex over a bracket/delimited tag → canonical tags. */
const LANGUAGE_MARKERS: { re: RegExp; langs: string[] }[] = [
  // Multi-language combos first (longer, more specific)
  { re: /^简繁日(?:内[封嵌])?字幕?$/i, langs: ["zh-Hans", "zh-Hant", "ja"] },
  { re: /^(?:简|繁)日双语$/i, langs: ["zh-Hans", "zh-Hant", "ja"] },
  { re: /^简繁(?:内[封嵌]|双?语|字幕)?$/i, langs: ["zh-Hans", "zh-Hant"] },
  { re: /^(?:中英|中日)(?:双语)?$/i, langs: ["zh-Hans"] },
  { re: /^GB(?:内嵌)?$/i, langs: ["zh-Hans"] },
  { re: /^BIG5$/i, langs: ["zh-Hant"] },
  // Single-language
  { re: /^简[体中]?$/, langs: ["zh-Hans"] },
  { re: /^繁[体中]?$/, langs: ["zh-Hant"] },
  { re: /^CHS$/i, langs: ["zh-Hans"] },
  { re: /^CHT$/i, langs: ["zh-Hant"] },
  // Raw Japanese audio, no subtitles
  { re: /^(?:日语|日文|生肉)$/, langs: [] },
];

/** Subtitle delivery format markers found inside the same tag. */
const FORMAT_MARKERS: { re: RegExp; format: "embedded" | "closed" }[] = [
  { re: /内封|外挂|外置/, format: "closed" },
  { re: /内嵌|内挂|硬字幕/, format: "embedded" },
];

/**
 * Parse subtitle language/format info from a release title by scanning the
 * bracketed tags (and trailing free-text segments), e.g.
 * "[Nix-Raws] … [简繁内封]" → zh-Hans + zh-Hant, closed captions,
 * "[黒ネズミたち] … (CR 1920x1080 AVC AAC MKV)" → no subtitle info.
 */
export function extractSubtitleInfo(title: string): SubtitleInfo {
  const segments: string[] = [];
  for (const m of title.matchAll(/[\[【]([^\]】]{1,40})[\]】]/g)) {
    segments.push(m[1]);
  }
  // Also scan the text after the last bracket (some groups append there)
  const tail = title.replace(/[\[【][^\]】]*[\]】]/g, " ").trim();
  if (tail) segments.push(tail);

  const languages = new Set<string>();
  let matchedRaw: string | null = null;

  for (const segment of segments) {
    for (const { re, langs } of LANGUAGE_MARKERS) {
      if (!re.test(segment.trim())) continue;
      for (const lang of langs) languages.add(lang);
      if (!matchedRaw) matchedRaw = segment.trim();
      break;
    }
  }

  let format: SubtitleInfo["format"] = null;
  outer: for (const segment of segments) {
    for (const { re, format: f } of FORMAT_MARKERS) {
      if (re.test(segment)) {
        format = f;
        break outer;
      }
    }
  }

  return { languages: [...languages], format, raw: matchedRaw };
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

function sha1Hex(value: string): string {
  return createHash("sha1").update(value).digest("hex");
}

/**
 * Dedup key for a torrent: the real btih from the magnet when available,
 * otherwise sha1(torrentUrl), otherwise a sha1 of whatever we have.
 */
export function computeInfoHash(
  magnet?: string | null,
  torrentUrl?: string | null
): string {
  return (
    (magnet ? extractInfoHash(magnet) : null) ??
    (torrentUrl ? sha1Hex(torrentUrl) : null) ??
    sha1Hex(`${magnet ?? ""}|${torrentUrl ?? ""}`)
  );
}
