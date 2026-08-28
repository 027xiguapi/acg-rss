/** Default rows-per-page for the admin list tables. */
export const PAGE_SIZE = 20;

/** Parse the `page` search param into a 1-based page number. */
export function parsePage(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

/**
 * LIKE/ILIKE pattern for a free-text search: escape the wildcard characters
 * so the input matches literally, wrapped in `%…%` for a contains match.
 */
export function searchPattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, "\\$&")}%`;
}
