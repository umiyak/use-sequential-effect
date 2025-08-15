import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { useSequentialEffect } from "../src/useSequentialEffect";
import type { Effect } from "./types";

function makeEffect(label: string, log: string[]): Effect {
  return () => {
    log.push(`start:${label}`);
    return () => {
      log.push(`cleanup:${label}`);
    };
  };
}

class Deferred<T = void> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
  constructor() {
    this.promise = new Promise<T>((res, rej) => {
      this.resolve = res;
      this.reject = rej;
    });
  }
}

function makeAsyncEffect(
  label: string,
  log: string[],
  opts?: { setupLatch?: Deferred<void>; cleanupLatch?: Deferred<void> },
): Effect {
  const setupLatch = opts?.setupLatch;
  const cleanupLatch = opts?.cleanupLatch;

  return async () => {
    if (setupLatch) await setupLatch.promise;
    log.push(`start:${label}`);

    return async () => {
      if (cleanupLatch) await cleanupLatch.promise;
      log.push(`cleanup:${label}`);
    };
  };
}

describe("useSequentialEffect", () => {
  it("behaves like useEffect: runs on mount and cleans up on unmount", async () => {
    // Given: a simple effect that logs start/cleanup
    const log: string[] = [];
    const effectA = makeEffect("A", log);

    // When: the hook is mounted and then unmounted
    const { unmount } = renderHook(
      ({ effect }) => useSequentialEffect(effect, [effect]),
      { initialProps: { effect: effectA } },
    );
    await act(async () => {
      unmount();
    });

    // Then: start should be logged on mount, and cleanup on unmount (in that order)
    await waitFor(() => {
      expect(log).toEqual(["start:A", "cleanup:A"]);
    });
  });

  it("supports async setup and async cleanup", async () => {
    // Given: an async effect whose setup returns an async cleanup
    const log: string[] = [];
    const asyncEffectA = makeAsyncEffect("A", log);

    // When: the hook is mounted and then unmounted
    const { unmount } = renderHook(
      ({ effect }) => useSequentialEffect(effect, [effect]),
      { initialProps: { effect: asyncEffectA } },
    );
    await act(async () => {
      unmount();
    });

    // Then: start happens before cleanup, even with async boundaries
    await waitFor(() => {
      expect(log).toEqual(["start:A", "cleanup:A"]);
    });
  });

  it("runs effects sequentially: next waits for previous cleanup to finish", async () => {
    // Given: effect A is running and its cleanup is latched (blocked)
    //  - We start with A mounted.
    //  - cleanupLatchA keeps A's cleanup pending so we can verify that B does not start early.
    const log: string[] = [];
    const cleanupLatchA = new Deferred<void>();
    const A = makeAsyncEffect("A", log, { cleanupLatch: cleanupLatchA });
    const B = makeAsyncEffect("B", log);

    const { rerender } = renderHook(
      ({ effect }) => useSequentialEffect(effect, [effect]),
      { initialProps: { effect: A } },
    );

    // When: while A is active, we request to run B (by changing deps)
    await act(async () => {
      rerender({ effect: B });
    });

    // Then: B must not start yet (A hasn't cleaned up)
    expect(log).toEqual(["start:A"]);

    // When: we release A's cleanup latch (allow cleanup to complete)
    await act(async () => {
      cleanupLatchA.resolve();
    });

    // Then: A's cleanup occurs, then B starts — strictly in sequence
    await waitFor(() => {
      expect(log).toEqual(["start:A", "cleanup:A", "start:B"]);
    });
  });

  it("continues when async setup rejects: failing effect never starts, next effect runs", async () => {
    // Given: A's setup awaits a latch and will reject; B is a normal async effect
    const log: string[] = [];
    const setupLatchA = new Deferred<void>();
    const A = makeAsyncEffect("A", log, { setupLatch: setupLatchA });
    const B = makeAsyncEffect("B", log);

    // When: mount with A (setup is awaiting), then reject setup and switch to B
    const { rerender, unmount } = renderHook(
      ({ effect }) => useSequentialEffect(effect, [effect]),
      { initialProps: { effect: A } },
    );
    await act(async () => {
      setupLatchA.reject(new Error("setup failed"));
    });
    await act(async () => {
      rerender({ effect: B });
    });

    // Then: A never started; B starts fine
    await waitFor(() => {
      expect(log).toContain("start:B");
      expect(log).not.toContain("start:A");
    });

    // And: unmount cleans up B
    await act(async () => {
      unmount();
    });
    await waitFor(() => {
      expect(log).toEqual(["start:B", "cleanup:B"]);
    });
  });

  it("continues when async cleanup rejects: skips cleanup log and starts next effect", async () => {
    // Given: A's cleanup will reject; B is a normal async effect
    const log: string[] = [];
    const cleanupLatchA = new Deferred<void>();
    const A = makeAsyncEffect("A", log, { cleanupLatch: cleanupLatchA });
    const B = makeAsyncEffect("B", log);

    const { rerender, unmount } = renderHook(
      ({ effect }) => useSequentialEffect(effect, [effect]),
      { initialProps: { effect: A } },
    );

    // Ensure A started
    await waitFor(() => expect(log).toContain("start:A"));

    // When: request B while A is active (A must cleanup first)
    await act(async () => {
      rerender({ effect: B });
    });

    // Then: B hasn't started yet (cleanup of A still pending)
    expect(log).toEqual(["start:A"]);

    // When: reject A's cleanup (throws during await)
    await act(async () => {
      cleanupLatchA.reject(new Error("cleanup failed"));
    });

    // Then: runner swallows the error, starts B; note cleanup:A log is skipped
    await waitFor(() => {
      expect(log).toEqual(["start:A", "start:B"]);
      expect(log).not.toContain("cleanup:A");
    });

    // And: unmount cleans up B
    await act(async () => {
      unmount();
    });
    await waitFor(() => {
      expect(log).toEqual(["start:A", "start:B", "cleanup:B"]);
    });
  });
});
