import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Resolve a bangumi's cover to a local image under public/images/bangumi when
 * a matching file exists, otherwise fall back to the stored cover URL. Local
 * files are named after the primary (display) title, e.g. "葬送的芙莉莲.webp".
 *
 * Server-only: reads the filesystem, so keep it out of client bundles.
 */
export function resolveCover(
  coverName: string | null,
  coverUrl: string | null
): string | null {
  if (coverName) {
    const file = path.join(
      process.cwd(),
      "public",
      "images",
      "bangumi",
      `${coverName}.webp`
    );
    if (existsSync(file)) {
      return `/images/bangumi/${encodeURIComponent(coverName)}.webp`;
    }
  }
  return coverUrl;
}
