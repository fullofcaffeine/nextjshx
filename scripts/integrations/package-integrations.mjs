#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { verifyRepositoryPackageIntegrations } from "./package-contract.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

try {
  const result = verifyRepositoryPackageIntegrations(ROOT);
  console.log(
    `[package-integrations] OK: ${result.integrations} reviewed integration, ${result.modules} public module, exact package/declaration/source provenance`,
  );
} catch (error) {
  console.error(`[package-integrations] ERROR: ${error.message}`);
  process.exitCode = 1;
}
