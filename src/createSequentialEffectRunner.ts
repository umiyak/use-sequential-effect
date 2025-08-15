import type { Cleanup, Effect } from "./types";

export function createSequentialEffectRunner() {
  let lastEffect: Effect | null = null;
  let stopRequested = false;
  let currentCleanup: Cleanup | undefined;

  let isLooping = false;

  function run(effect: Effect): void {
    lastEffect = effect;
    stopRequested = false;
    ensureLoop();
  }

  function stop(): void {
    lastEffect = null;
    stopRequested = true;
    ensureLoop();
  }

  function ensureLoop() {
    if (isLooping) return;
    isLooping = true;
    loop().finally(() => {
      isLooping = false;
      if (stopRequested || lastEffect) {
        ensureLoop();
      }
    });
  }

  async function loop(): Promise<void> {
    while (true) {
      const shouldStop = stopRequested;
      const next = lastEffect;

      if (!shouldStop && next == null) break;

      stopRequested = false;
      lastEffect = null;

      if (currentCleanup) {
        const fn = currentCleanup;
        currentCleanup = undefined;
        try {
          await fn();
        } catch (e) {
          console.error(e);
        }
      }

      if (shouldStop) {
        continue;
      }

      if (next) {
        try {
          const maybeCleanup = await next();
          if (typeof maybeCleanup === "function") {
            currentCleanup = maybeCleanup;
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
  }

  return { run, stop };
}
