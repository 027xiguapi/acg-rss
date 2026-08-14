/**
 * Next.js instrumentation hook — runs once when the server process boots.
 * Used to start the in-process background scheduler (RSS refresh, matcher,
 * qBittorrent sync). Disable with JOBS_ENABLED=false.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureSchedulerStarted } = await import(
    "./server/jobs/scheduler"
  );
  ensureSchedulerStarted();
}
