export type SignalUnit = "db" | "hz";

export function formatSignal(value: number, unit: SignalUnit): string {
  return `${String(value).padStart(2, "0")} ${unit.toUpperCase()}`;
}

export function signalBand(value: number): "quiet" | "nominal" | "hot" {
  if (value < 35) return "quiet";
  if (value < 76) return "nominal";
  return "hot";
}
