export interface ParsedBangumiName {
  title: string;
  lang: string | null;
}

/**
 * Parse the multi-line names field. One name per line, optionally suffixed
 * with a language tag: `葬送的芙莉莲 | zh-Hans`.
 */
export function parseNamesField(raw: string | null | undefined): ParsedBangumiName[] {
  const seen = new Set<string>();
  const names: ParsedBangumiName[] = [];
  for (const line of (raw ?? "").split(/\r?\n/)) {
    const match = /^(.+?)\s*[|｜]\s*([\w-]{1,16})$/.exec(line.trim());
    const title = (match ? match[1] : line.trim()).trim();
    const lang = match ? match[2].toLowerCase() : null;
    const key = title.toLowerCase();
    if (!title || title.length > 255 || seen.has(key)) continue;
    seen.add(key);
    names.push({ title, lang });
  }
  return names;
}
