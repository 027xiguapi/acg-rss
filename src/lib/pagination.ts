/** Default rows-per-page for the admin list tables. */
export const PAGE_SIZE = 20;

/** Selectable rows-per-page options for the admin list tables. */
export const PAGE_SIZES = [10, 20, 50, 100] as const;

/** Parse the `page` search param into a 1-based page number. */
export function parsePage(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

/** Parse the `pageSize` search param, falling back to the default. */
export function parsePageSize(value: string | undefined): number {
  const n = Number(value);
  return (PAGE_SIZES as readonly number[]).includes(n) ? n : PAGE_SIZE;
}

/**
 * LIKE/ILIKE pattern for a free-text search: escape the wildcard characters
 * so the input matches literally, wrapped in `%…%` for a contains match.
 */
export function searchPattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, "\\$&")}%`;
}
