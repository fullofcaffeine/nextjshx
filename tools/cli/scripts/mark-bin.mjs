#!/usr/bin/env node

import { chmodSync } from "node:fs";
import { fileURLToPath } from "node:url";

const compiledEntrypoint = fileURLToPath(new URL("../.tmp/src/cli.js", import.meta.url));
const launcher = fileURLToPath(new URL("../bin/nextjshx.js", import.meta.url));
chmodSync(compiledEntrypoint, 0o755);
chmodSync(launcher, 0o755);
