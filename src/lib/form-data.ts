/** Parse a repeated form field ("ids") into a list of positive integers. */
export function parseIdList(formData: FormData, field = "ids"): number[] {
  const ids = new Set<number>();
  for (const raw of formData.getAll(field)) {
    const n = Number(raw);
    if (Number.isInteger(n) && n > 0) ids.add(n);
  }
  return [...ids];
}
