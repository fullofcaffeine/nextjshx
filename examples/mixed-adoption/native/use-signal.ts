"use client";

import { useState } from "react";

export interface NativeSignalReading {
  readonly value: number;
  readonly mode: "receive" | "transmit";
  readonly raise: () => void;
  readonly lower: () => void;
  readonly toggleMode: () => void;
}

export function useNativeSignal(initialValue: number): NativeSignalReading {
  const [value, setValue] = useState(initialValue);
  const [mode, setMode] = useState<"receive" | "transmit">("receive");

  return {
    value,
    mode,
    raise: () => setValue((current) => Math.min(99, current + 4)),
    lower: () => setValue((current) => Math.max(0, current - 4)),
    toggleMode: () =>
      setMode((current) => (current === "receive" ? "transmit" : "receive")),
  };
}
