#!/usr/bin/env node

import assert from "node:assert/strict";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  PackageIntegrationFailure,
  loadPackageIntegrationContract,
  validatePackageIntegrationDocument,
  verifyPackageIntegrationDocument,
} from "../integrations/package-contract.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function cloned(value) {
  return structuredClone(value);
}

function expectFailure(action, fragment) {
  assert.throws(
    action,
    (error) => error instanceof PackageIntegrationFailure && error.message.includes(fragment),
    fragment,
  );
}

try {
  const { document, schema } = loadPackageIntegrationContract(ROOT);
  const result = verifyPackageIntegrationDocument(document, ROOT);
  assert.deepEqual(result.packages, [
    "cmdk",
    "@dnd-kit/helpers",
    "@dnd-kit/react",
    "@mdx-js/loader",
    "@mdx-js/react",
    "@next/mdx",
    "nuqs",
    "@radix-ui/react-dialog",
    "@radix-ui/react-slot",
    "recharts",
    "rehype-pretty-code",
    "rehype-slug",
    "remark-gfm",
  ]);
  const helpersIndex = document.integrations.findIndex(
    (integration) => integration.id === "dnd-kit-helpers",
  );
  const dndReactIndex = document.integrations.findIndex(
    (integration) => integration.id === "dnd-kit-react",
  );
  const nuqsIndex = document.integrations.findIndex((integration) => integration.id === "nuqs");
  const cmdkIndex = document.integrations.findIndex((integration) => integration.id === "cmdk");
  const dialogIndex = document.integrations.findIndex(
    (integration) => integration.id === "radix-dialog",
  );
  const radixIndex = document.integrations.findIndex((integration) => integration.id === "radix-slot");
  const rechartsIndex = document.integrations.findIndex((integration) => integration.id === "recharts");
  assert.notEqual(helpersIndex, -1);
  assert.notEqual(dndReactIndex, -1);
  assert.notEqual(nuqsIndex, -1);
  assert.notEqual(cmdkIndex, -1);
  assert.notEqual(dialogIndex, -1);
  assert.notEqual(radixIndex, -1);
  assert.notEqual(rechartsIndex, -1);

  for (const id of [
    "mdx-loader",
    "mdx-react",
    "next-mdx",
    "rehype-pretty-code",
    "rehype-slug",
    "remark-gfm",
  ]) {
    const index = document.integrations.findIndex((integration) => integration.id === id);
    assert.notEqual(index, -1, `${id} is absent from the reviewed package inventory`);

    const wrongPluginVersion = cloned(document);
    wrongPluginVersion.integrations[index].version = "0.0.0";
    expectFailure(
      () => verifyPackageIntegrationDocument(wrongPluginVersion, ROOT),
      "expected 0.0.0, found",
    );

    const wrongPluginDigest = cloned(document);
    wrongPluginDigest.integrations[index].modules[0].declarationSha256 = "0".repeat(64);
    expectFailure(
      () => verifyPackageIntegrationDocument(wrongPluginDigest, ROOT),
      "declaration digest changed",
    );

    const missingPluginExport = cloned(document);
    missingPluginExport.integrations[index].modules[0].requiredExports = ["MissingReviewedExport"];
    expectFailure(
      () => verifyPackageIntegrationDocument(missingPluginExport, ROOT),
      "no longer exports required symbol MissingReviewedExport",
    );
  }

  const wrongCmdkVersion = cloned(document);
  wrongCmdkVersion.integrations[cmdkIndex].version = "1.1.0";
  expectFailure(
    () => verifyPackageIntegrationDocument(wrongCmdkVersion, ROOT),
    "expected 1.1.0, found 1.1.1",
  );

  const wrongHelpersVersion = cloned(document);
  wrongHelpersVersion.integrations[helpersIndex].version = "0.5.1";
  expectFailure(
    () => verifyPackageIntegrationDocument(wrongHelpersVersion, ROOT),
    "expected 0.5.1, found 0.5.0",
  );

  const wrongDndReactVersion = cloned(document);
  wrongDndReactVersion.integrations[dndReactIndex].version = "0.5.1";
  expectFailure(
    () => verifyPackageIntegrationDocument(wrongDndReactVersion, ROOT),
    "expected 0.5.1, found 0.5.0",
  );

  const wrongVersion = cloned(document);
  wrongVersion.integrations[radixIndex].version = "1.3.1";
  expectFailure(
    () => verifyPackageIntegrationDocument(wrongVersion, ROOT),
    "expected 1.3.1, found 1.3.0",
  );

  const wrongDialogVersion = cloned(document);
  wrongDialogVersion.integrations[dialogIndex].version = "1.1.20";
  expectFailure(
    () => verifyPackageIntegrationDocument(wrongDialogVersion, ROOT),
    "expected 1.1.20, found 1.1.19",
  );

  const wrongRechartsVersion = cloned(document);
  wrongRechartsVersion.integrations[rechartsIndex].version = "3.8.0";
  expectFailure(
    () => verifyPackageIntegrationDocument(wrongRechartsVersion, ROOT),
    "expected 3.8.0, found 3.8.1",
  );

  const missingExport = cloned(document);
  missingExport.integrations[radixIndex].modules[0].requiredExports = ["MissingPolymorphicExport"];
  expectFailure(
    () => verifyPackageIntegrationDocument(missingExport, ROOT),
    "no longer exports required symbol MissingPolymorphicExport",
  );

  const missingDialogExport = cloned(document);
  missingDialogExport.integrations[dialogIndex].modules[0].requiredExports = [
    "MissingDialogExport",
  ];
  expectFailure(
    () => verifyPackageIntegrationDocument(missingDialogExport, ROOT),
    "no longer exports required symbol MissingDialogExport",
  );

  const missingCmdkExport = cloned(document);
  missingCmdkExport.integrations[cmdkIndex].modules[0].requiredExports = [
    "MissingCommandExport",
  ];
  expectFailure(
    () => verifyPackageIntegrationDocument(missingCmdkExport, ROOT),
    "no longer exports required symbol MissingCommandExport",
  );

  const missingHelpersExport = cloned(document);
  missingHelpersExport.integrations[helpersIndex].modules[0].requiredExports = [
    "missingArrayMove",
  ];
  expectFailure(
    () => verifyPackageIntegrationDocument(missingHelpersExport, ROOT),
    "no longer exports required symbol missingArrayMove",
  );

  const missingDndReactExport = cloned(document);
  missingDndReactExport.integrations[dndReactIndex].modules[1].requiredExports = [
    "missingSortableHook",
  ];
  expectFailure(
    () => verifyPackageIntegrationDocument(missingDndReactExport, ROOT),
    "no longer exports required symbol missingSortableHook",
  );

  const missingRechartsExport = cloned(document);
  missingRechartsExport.integrations[rechartsIndex].modules[0].requiredExports = [
    "MissingChartExport",
  ];
  expectFailure(
    () => verifyPackageIntegrationDocument(missingRechartsExport, ROOT),
    "no longer exports required symbol MissingChartExport",
  );

  const wrongDigest = cloned(document);
  wrongDigest.integrations[nuqsIndex].modules[1].declarationSha256 = "0".repeat(64);
  expectFailure(
    () => verifyPackageIntegrationDocument(wrongDigest, ROOT),
    "declaration digest changed",
  );

  const wrongDialogDigest = cloned(document);
  wrongDialogDigest.integrations[dialogIndex].modules[0].declarationSha256 = "0".repeat(64);
  expectFailure(
    () => verifyPackageIntegrationDocument(wrongDialogDigest, ROOT),
    "declaration digest changed",
  );

  const wrongCmdkDigest = cloned(document);
  wrongCmdkDigest.integrations[cmdkIndex].modules[0].declarationSha256 = "0".repeat(64);
  expectFailure(
    () => verifyPackageIntegrationDocument(wrongCmdkDigest, ROOT),
    "declaration digest changed",
  );

  const wrongHelpersDigest = cloned(document);
  wrongHelpersDigest.integrations[helpersIndex].modules[0].declarationSha256 = "0".repeat(64);
  expectFailure(
    () => verifyPackageIntegrationDocument(wrongHelpersDigest, ROOT),
    "declaration digest changed",
  );

  const wrongDndReactDigest = cloned(document);
  wrongDndReactDigest.integrations[dndReactIndex].modules[1].declarationSha256 = "0".repeat(64);
  expectFailure(
    () => verifyPackageIntegrationDocument(wrongDndReactDigest, ROOT),
    "declaration digest changed",
  );

  const wrongRechartsDigest = cloned(document);
  wrongRechartsDigest.integrations[rechartsIndex].modules[0].declarationSha256 = "0".repeat(64);
  expectFailure(
    () => verifyPackageIntegrationDocument(wrongRechartsDigest, ROOT),
    "declaration digest changed",
  );

  const escapingPath = cloned(document);
  escapingPath.integrations[nuqsIndex].evidence = ["../outside-nextjshx.txt"];
  expectFailure(
    () => validatePackageIntegrationDocument(escapingPath, schema),
    "invalid package integration manifest",
  );

  console.log(
    `[package-integrations] OK: ${result.integrations} positive contracts plus per-package version, export, digest, and path negatives`,
  );
} catch (error) {
  console.error(`[package-integrations] ERROR: ${error.message}`);
  process.exitCode = 1;
}
