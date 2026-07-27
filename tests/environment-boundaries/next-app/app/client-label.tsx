"use client";

import { ClientLabels } from "../generated/environment_boundaries/positive/ClientLabels";

export function ClientLabel() {
  return <p id="client-label">{ClientLabels.label()}</p>;
}
