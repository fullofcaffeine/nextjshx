import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  runCli,
  runProfileCommand,
} from "../src/index.js";

function writeJson(file: string, value: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function fixtureRoot(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "nextjshx-profile-"));
  mkdirSync(path.join(root, "src/app"), { recursive: true });
  writeJson(path.join(root, "package.json"), {
    name: "nextjshx-profile-fixture",
    private: true,
    packageManager: "npm@10.8.2",
    dependencies: { next: "16.2.12" },
  });
  writeJson(path.join(root, "package-lock.json"), {
    name: "nextjshx-profile-fixture",
    lockfileVersion: 3,
  });
  writeJson(path.join(root, "nextjshx.config.json"), {
    $schema: "https://nextjshx.dev/schemas/config-v2.json",
    schemaVersion: 2,
    appRoot: "src/app",
    haxe: {
      hxml: "build.hxml",
      generatedRoot: "src-gen",
      defines: [],
    },
    next: {
      package: "next",
      typedRoutes: true,
    },
    output: {
      manifest: ".nextjshx/manifest.json",
      format: "project",
      language: "typescript",
      intent: "reviewable",
      profileVersion: 1,
      sourceMaps: "external",
      sourcesContent: true,
      declarations: "public",
      jsxRuntime: "automatic",
    },
  });
  writeFileSync(path.join(root, "build.hxml"), "-main Main\n-js src-gen/index.tsx\n");
  return root;
}

test("profile show and list report deterministic maturity without mutation", () => {
  const root = fixtureRoot();
  try {
    const configPath = path.join(root, "nextjshx.config.json");
    const before = readFileSync(configPath, "utf8");
    const shown = runProfileCommand({
      start: root,
      operation: "show",
    });
    assert.equal(shown.command, "profile");
    assert.equal(shown.operation, "show");
    assert.equal(shown.profile.language, "typescript");
    assert.equal(shown.profile.intent, "reviewable");
    assert.equal(shown.maturity, "preview");
    assert.equal(shown.qualified, false);
    assert.match(shown.fingerprint, /^[0-9a-f]{64}$/);
    assert.deepEqual(shown.cells, []);
    assert.deepEqual(shown.unsupportedCapabilities, [
      "reviewable-implementation-output",
      "end-to-end-source-map-debugging",
    ]);

    const previousNodeEnv = process.env.NODE_ENV;
    const productionEnvironment = (() => {
      try {
        process.env.NODE_ENV = "production";
        return runProfileCommand({
          start: root,
          operation: "show",
        });
      } finally {
        if (previousNodeEnv === undefined) {
          delete process.env.NODE_ENV;
        } else {
          process.env.NODE_ENV = previousNodeEnv;
        }
      }
    })();
    assert.deepEqual(productionEnvironment.profile, shown.profile);
    assert.equal(productionEnvironment.fingerprint, shown.fingerprint);

    const listed = runProfileCommand({
      start: root,
      operation: "list",
    });
    assert.deepEqual(
      listed.cells.map((cell) => [
        cell.language,
        cell.intent,
        cell.maturity,
      ]),
      [
        ["typescript", "reviewable", "preview"],
        ["typescript", "optimized", "experimental"],
        ["javascript", "reviewable", "planned"],
        ["javascript", "optimized", "planned"],
      ],
    );
    assert.equal(readFileSync(configPath, "utf8"), before);
    assert.equal(existsSync(path.join(root, ".nextjshx")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("profile CLI emits bounded human/JSON output and validate fails unqualified cells", async () => {
  const root = fixtureRoot();
  try {
    let stdout = "";
    let stderr = "";
    assert.equal(
      await runCli(["profile", "show"], {
        cwd: root,
        stdout: (value) => {
          stdout += value;
        },
        stderr: (value) => {
          stderr += value;
        },
      }),
      0,
    );
    assert.match(stdout, /selected: typescript\/reviewable/);
    assert.match(stdout, /maturity: preview/);
    assert.equal(stderr, "");

    stdout = "";
    assert.equal(
      await runCli(["profile", "list", "--json"], {
        cwd: root,
        stdout: (value) => {
          stdout += value;
        },
      }),
      0,
    );
    const decoded = JSON.parse(stdout) as {
      ok: boolean;
      result: { cells: readonly unknown[] };
    };
    assert.equal(decoded.ok, true);
    assert.equal(decoded.result.cells.length, 4);

    stdout = "";
    assert.equal(
      await runCli(["profile", "validate"], {
        cwd: root,
        stdout: (value) => {
          stdout += value;
        },
      }),
      1,
    );
    assert.match(stdout, /profile validate: not qualified/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("profile diff compares one explicit cell without changing project state", async () => {
  const root = fixtureRoot();
  try {
    const configPath = path.join(root, "nextjshx.config.json");
    const before = readFileSync(configPath, "utf8");
    const compared = runProfileCommand({
      start: root,
      operation: "diff",
      target: {
        language: "javascript",
        intent: "optimized",
      },
    });
    assert.deepEqual(
      compared.comparison?.changes.map((change) => [
        change.field,
        change.from,
        change.to,
      ]),
      [
        ["language", "typescript", "javascript"],
        ["intent", "reviewable", "optimized"],
      ],
    );
    assert.deepEqual(compared.comparison?.compilerDefinesAdded, [
      "dts",
      "genes.no_extension",
      "genes.react.inline_markup",
      "genes.react.jsx_runtime_module=react",
    ]);
    assert.deepEqual(compared.comparison?.compilerDefinesRemoved, [
      "genes.ts",
      "genes.ts.jsx_import_source=react",
      "genes.ts.no_extension",
    ]);

    let stdout = "";
    assert.equal(
      await runCli(
        [
          "profile",
          "diff",
          "--to",
          "javascript/optimized",
          "--json",
        ],
        {
          cwd: root,
          stdout: (value) => {
            stdout += value;
          },
        },
      ),
      0,
    );
    const decoded = JSON.parse(stdout) as {
      result: {
        comparison: {
          profile: { language: string; intent: string };
          changes: readonly unknown[];
        };
      };
    };
    assert.deepEqual(decoded.result.comparison.profile, {
      language: "javascript",
      intent: "optimized",
      profileVersion: 1,
      sourceMaps: "external",
      sourcesContent: true,
      declarations: "public",
      jsxRuntime: "automatic",
    });
    assert.equal(decoded.result.comparison.changes.length, 2);
    assert.equal(readFileSync(configPath, "utf8"), before);
    assert.equal(existsSync(path.join(root, ".nextjshx")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("profile CLI rejects missing and unknown operations", async () => {
  for (const args of [
    ["profile"],
    ["profile", "diff"],
    ["profile", "show", "--to", "typescript/optimized"],
    ["profile", "diff", "--to", "typescript/reviewable", "--to", "javascript/reviewable"],
    ["profile", "diff", "--to", "typescript/native-source"],
    ["profile", "show", "list"],
  ]) {
    let stderr = "";
    assert.equal(
      await runCli(args, {
        stderr: (value) => {
          stderr += value;
        },
      }),
      1,
    );
    assert.match(stderr, /NXHX-CLI-USAGE-0001/);
  }
});
