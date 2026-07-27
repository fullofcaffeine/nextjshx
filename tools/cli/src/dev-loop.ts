import type { WatchChangeKind } from "./watch-inputs.js";

export interface SerializedDirtyLoopOptions {
  readonly debounceMs: number;
  readonly run: (kind: WatchChangeKind) => Promise<void>;
  readonly onError: (error: Error) => void;
}

export type SerializedDirtyLoopState =
  | "idle"
  | "debouncing"
  | "compiling"
  | "closed";

function stronger(
  left: WatchChangeKind | null,
  right: WatchChangeKind,
): WatchChangeKind {
  return left === "identity" || right === "identity" ? "identity" : "source";
}

/**
 * Serializes filesystem bursts without losing an event that arrives while a
 * compilation is active. At most one run exists; pending changes collapse to
 * the strongest (identity-changing) cause and produce one newest-state pass.
 */
export class SerializedDirtyLoop {
  readonly #options: SerializedDirtyLoopOptions;
  #state: SerializedDirtyLoopState = "idle";
  #pending: WatchChangeKind | null = null;
  #lastRequestAt = 0;
  #timer: NodeJS.Timeout | null = null;
  #active: Promise<void> | null = null;
  #idleWaiters: Array<() => void> = [];

  constructor(options: SerializedDirtyLoopOptions) {
    if (!Number.isInteger(options.debounceMs) || options.debounceMs < 0) {
      throw new Error("SerializedDirtyLoop debounceMs must be a non-negative integer");
    }
    this.#options = options;
  }

  get state(): SerializedDirtyLoopState {
    return this.#state;
  }

  request(kind: WatchChangeKind): void {
    if (this.#state === "closed") {
      return;
    }
    this.#pending = stronger(this.#pending, kind);
    this.#lastRequestAt = Date.now();
    if (this.#state === "compiling") {
      return;
    }
    this.#schedule(this.#options.debounceMs);
  }

  async waitForIdle(): Promise<void> {
    if (
      this.#state === "idle" &&
      this.#pending === null &&
      this.#timer === null &&
      this.#active === null
    ) {
      return;
    }
    await new Promise<void>((resolve) => this.#idleWaiters.push(resolve));
  }

  async close(): Promise<void> {
    if (this.#state === "closed") {
      if (this.#active !== null) {
        await this.#active;
      }
      return;
    }
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    this.#pending = null;
    this.#state = "closed";
    if (this.#active !== null) {
      await this.#active;
    }
    this.#resolveIdle();
  }

  #schedule(delay: number): void {
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
    }
    this.#state = "debouncing";
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.#start();
    }, delay);
  }

  #start(): void {
    if (this.#state === "closed" || this.#active !== null) {
      return;
    }
    const kind = this.#pending;
    if (kind === null) {
      this.#state = "idle";
      this.#resolveIdle();
      return;
    }
    this.#pending = null;
    this.#state = "compiling";
    const active = this.#options.run(kind)
      .catch((error: Error) => this.#options.onError(error))
      .finally(() => {
        this.#active = null;
        if (this.#state === "closed") {
          this.#resolveIdle();
          return;
        }
        if (this.#pending === null) {
          this.#state = "idle";
          this.#resolveIdle();
          return;
        }
        const elapsed = Math.max(0, Date.now() - this.#lastRequestAt);
        this.#schedule(Math.max(0, this.#options.debounceMs - elapsed));
      });
    this.#active = active;
  }

  #resolveIdle(): void {
    const waiters = this.#idleWaiters;
    this.#idleWaiters = [];
    for (const resolve of waiters) {
      resolve();
    }
  }
}
