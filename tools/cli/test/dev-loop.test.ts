import assert from "node:assert/strict";
import test from "node:test";

import { SerializedDirtyLoop, type WatchChangeKind } from "../src/index.js";

interface Deferred {
  readonly promise: Promise<void>;
  resolve(): void;
}

function deferred(): Deferred {
  let resolvePromise: (() => void) | null = null;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  return Object.freeze({
    promise,
    resolve(): void {
      resolvePromise?.();
    },
  });
}

async function eventually(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (!condition()) {
    if (Date.now() >= deadline) {
      assert.fail("condition did not become true before the test deadline");
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }
}

test("dirty changes during compilation collapse into one serialized newest-state follow-up", async () => {
  const releases = [deferred(), deferred()];
  const causes: WatchChangeKind[] = [];
  let active = 0;
  let maximumActive = 0;
  const errors: Error[] = [];
  const loop = new SerializedDirtyLoop({
    debounceMs: 0,
    run: async (kind) => {
      const index = causes.length;
      causes.push(kind);
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await (releases[index] as Deferred).promise;
      active -= 1;
    },
    onError: (error) => errors.push(error),
  });

  loop.request("source");
  await eventually(() => causes.length === 1);
  loop.request("source");
  loop.request("source");
  loop.request("identity");
  releases[0]?.resolve();
  await eventually(() => causes.length === 2);
  assert.deepEqual(causes, ["source", "identity"]);
  assert.equal(maximumActive, 1);
  releases[1]?.resolve();
  await loop.waitForIdle();
  assert.deepEqual(errors, []);
  await loop.close();
});

test("a rejected compile reports once and later changes still run", async () => {
  const causes: WatchChangeKind[] = [];
  const errors: Error[] = [];
  const loop = new SerializedDirtyLoop({
    debounceMs: 0,
    run: async (kind) => {
      causes.push(kind);
      if (causes.length === 1) {
        throw new Error("fixture compile failure");
      }
    },
    onError: (error) => errors.push(error),
  });
  loop.request("source");
  await loop.waitForIdle();
  loop.request("source");
  await loop.waitForIdle();
  assert.deepEqual(causes, ["source", "source"]);
  assert.equal(errors.length, 1);
  assert.equal(errors[0]?.message, "fixture compile failure");
  await loop.close();
});

test("close drops queued work and waits for the sole active compile", async () => {
  const release = deferred();
  let runs = 0;
  const loop = new SerializedDirtyLoop({
    debounceMs: 0,
    run: async () => {
      runs += 1;
      await release.promise;
    },
    onError: () => undefined,
  });
  loop.request("source");
  await eventually(() => runs === 1);
  loop.request("identity");
  const closing = loop.close();
  release.resolve();
  await closing;
  assert.equal(runs, 1);
  assert.equal(loop.state, "closed");
});
