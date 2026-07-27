"use client";

import { Component, createElement, useState, type ReactNode } from "react";
import { parseAsString, useQueryState } from "nuqs";

const secondaryLabels = [Promise.resolve("Cached secondary label")];

export function cachedSecondaryLabels(): Array<Promise<string>> {
  return secondaryLabels;
}

type FlightErrorBoundaryProps = {
  children: ReactNode;
  fallbackLabel: string;
};

type FlightErrorBoundaryState = {
  failed: boolean;
};

/** Native interop control proving rejected Flight resources reach an Error Boundary. */
export class FlightErrorBoundary extends Component<
  FlightErrorBoundaryProps,
  FlightErrorBoundaryState
> {
  state: FlightErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(_error: Error): FlightErrorBoundaryState {
    return { failed: true };
  }

  render() {
    return this.state.failed
      ? createElement("p", { id: "flight-rejection" }, this.props.fallbackLabel)
      : this.props.children;
  }
}

export function useCounter(initialCount: number) {
  const [count, setCount] = useState(initialCount);
  return {
    count,
    increment: () => setCount((current) => current + 1),
  };
}

export function useNativeQueryLabel(key: string) {
  const [value, setValue] = useQueryState(key, parseAsString.withDefault("native"));
  return {
    value,
    replace: (next: string) => setValue(next),
    clear: () => setValue(null),
  };
}
