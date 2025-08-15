import { useEffect, useRef } from "react";
import { createSequentialEffectRunner } from "./createSequentialEffectRunner";
import type { Effect } from "./types";

/**
 * Runs side effects in a sequential manner.
 *
 * - Registering a new effect skips any not-yet-started older effects.
 * - The next effect starts only after the current effect's cleanup finishes.
 * - On unmount (or deps change), the current effect's cleanup is invoked and awaited
 */
export function useSequentialEffect(
  effect: Effect,
  deps?: ReadonlyArray<unknown>,
): void {
  const runnerRef = useRef(createSequentialEffectRunner());

  useEffect(() => {
    const runner = runnerRef.current;
    runner.run(effect);

    return runner.stop;
    // biome-ignore lint/correctness/useExhaustiveDependencies: `undefined` cannot be directly passed as the second argument to useEffect
  }, deps);
}
