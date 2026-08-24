/** Deterministic poster tint derived from the title, so the wall feels varied. */
const POSTER_TINTS = [
  "from-rose-400 to-orange-300",
  "from-sky-400 to-cyan-300",
  "from-violet-400 to-purple-300",
  "from-emerald-400 to-teal-300",
  "from-amber-400 to-yellow-300",
  "from-pink-400 to-fuchsia-300",
  "from-indigo-400 to-blue-300",
  "from-lime-400 to-green-300",
] as const;

export function posterTint(title: string): string {
  let hash = 0;
  for (const ch of title) {
    hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) | 0;
  }
  return POSTER_TINTS[Math.abs(hash) % POSTER_TINTS.length];
}
