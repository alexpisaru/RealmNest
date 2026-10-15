/**
 * Frame loop on requestAnimationFrame, with a timer fallback for
 * environments where rAF is throttled or paused (embedded previews,
 * occluded windows). Returns a stop function.
 */
export function startLoop(frame: (now: number) => void, fallbackFps = 30): () => void {
  let raf = 0;
  let lastRun = 0;
  let stopped = false;
  const run = (now: number) => {
    lastRun = performance.now();
    frame(now);
  };
  const tick = (now: number) => {
    if (stopped) return;
    run(now);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  const timer = window.setInterval(() => {
    const now = performance.now();
    if (now - lastRun > 120) run(now);
  }, 1000 / fallbackFps);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
    window.clearInterval(timer);
  };
}
