"use client";

import { ServerSecrets } from "../../generated/environment_boundaries/positive/ServerSecrets";

export default function InvalidClientPage() {
  return <p>{ServerSecrets.configured() ? "configured" : "missing"}</p>;
}
