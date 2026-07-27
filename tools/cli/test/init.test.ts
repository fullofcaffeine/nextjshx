import assert from "node:assert/strict";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  CliDiagnosticError,
  type ProcessRequest,
  type ProcessResult,
  readNextJsHxConfig,
  runCli,
  runGenerateCommand,
  runInitCommand,
} from "../src/index.js";

const REPOSITORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

function writeJson(file: string, value: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function fixtureRoot(options: { readonly nativePage?: boolean } = {}): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "nextjshx-init-"));
  mkdirSync(path.join(root, "src/app"), { recursive: true });
  writeJson(path.join(root, "package.json"), {
    name: "init-fixture",
    private: true,
    packageManager: "npm@10.8.2",
    scripts: {},
    dependencies: {
      next: "16.2.12",
      react: "19.2.7",
      "react-dom": "19.2.7",
    },
    devDependencies: { typescript: "6.0.2" },
  });
  writeJson(path.join(root, "package-lock.json"), {
    name: "init-fixture",
    lockfileVersion: 3,
  });
  writeJson(path.join(root, "tsconfig.json"), {
    compilerOptions: { strict: true },
  });
  writeJson(path.join(root, "node_modules/next/package.json"), {
    name: "next",
    version: "16.2.12",
  });
  writeJson(path.join(root, "node_modules/typescript/package.json"), {
    name: "typescript",
    version: "6.0.2",
  });
  if (options.nativePage === true) {
    writeFileSync(
      path.join(root, "src/app/page.tsx"),
      "export default function NativePage() { return null; }\n",
      "utf8",
    );
  }
  return root;
}

function runtime(requests: ProcessRequest[]) {
  return {
    haxeCommand: { command: "fake-haxe", argsPrefix: [] },
    uuid: () => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    processRunner: (request: ProcessRequest): ProcessResult => {
      requests.push(request);
      return Object.freeze({
        exitCode: 0,
        stdout: request.args.includes("--version") ? "4.3.7\n" : "",
        stderr: "",
      });
    },
  };
}

function projectBytes(root: string, files: readonly string[]): Map<string, string> {
  return new Map(
    files.map((file) => [file, readFileSync(path.join(root, file), "utf8")]),
  );
}

test("init creates a byte-stable new-app baseline without changing the lockfile", () => {
  const root = fixtureRoot();
  const requests: ProcessRequest[] = [];
  try {
    const lockBefore = readFileSync(path.join(root, "package-lock.json"), "utf8");
    chmodSync(path.join(root, "package.json"), 0o640);
    const first = runInitCommand({ start: root, runtime: runtime(requests) });
    assert.equal(first.action, "initialized");
    assert.equal(first.typedRoutes, "disabled");
    assert.deepEqual(
      first.scripts.map((script) => [script.name, script.action]),
      [
        ["dev", "added"],
        ["generate", "added"],
        ["typecheck", "added"],
      ],
    );
    const created = [
      ".gitignore",
      "haxe/NextJsHxMain.hx",
      "haxe/nextjshx_app/AdapterPlan.hx",
      "haxe/nextjshx_app/HomePage.hx",
      "nextjshx.config.json",
      "nextjshx.hxml",
      "package.json",
    ];
    const beforeRepeat = projectBytes(root, created);
    const second = runInitCommand({ start: root, runtime: runtime(requests) });
    assert.equal(second.action, "unchanged");
    assert.deepEqual(projectBytes(root, created), beforeRepeat);
    assert.equal(
      readFileSync(path.join(root, "package-lock.json"), "utf8"),
      lockBefore,
    );
    assert.equal(statSync(path.join(root, "package.json")).mode & 0o777, 0o640);
    assert.match(
      readFileSync(path.join(root, "nextjshx.hxml"), "utf8"),
      /--macro nextjshx_app\.AdapterPlan\.install\(\)/,
    );
    assert.match(
      readFileSync(path.join(root, "haxe/nextjshx_app/HomePage.hx"), "utf8"),
      /@:next\.page\(""\)/,
    );
    assert.equal(
      readNextJsHxConfig(path.join(root, "nextjshx.config.json")).appRoot,
      "src/app",
    );
    assert.equal(requests.length, 6);
    assert(
      requests.every(
        (request) =>
          request.source === "haxe" && request.command === "fake-haxe",
      ),
    );
    assert.deepEqual(
      requests
        .filter((request) => request.args.includes("-lib"))
        .map((request) => request.args[request.args.indexOf("-lib") + 1]),
      ["genes-ts", "nextjshx", "genes-ts", "nextjshx"],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("init fails before mutation when required capabilities or package scripts are unsafe", () => {
  const missingTypescript = fixtureRoot();
  try {
    rmSync(path.join(missingTypescript, "node_modules/typescript"), {
      recursive: true,
      force: true,
    });
    const packageBefore = readFileSync(
      path.join(missingTypescript, "package.json"),
      "utf8",
    );
    assert.throws(
      () =>
        runInitCommand({
          start: missingTypescript,
          runtime: runtime([]),
        }),
      (error) => {
        assert(error instanceof CliDiagnosticError);
        assert.equal(error.diagnostic.code, "NXHX-CLI-INIT-0015");
        return true;
      },
    );
    assert.equal(
      readFileSync(path.join(missingTypescript, "package.json"), "utf8"),
      packageBefore,
    );
    assert.equal(
      existsSync(path.join(missingTypescript, "nextjshx.config.json")),
      false,
    );
  } finally {
    rmSync(missingTypescript, { recursive: true, force: true });
  }

  const unsafeScripts = fixtureRoot();
  try {
    const manifest = {
      name: "init-fixture",
      private: true,
      packageManager: "npm@10.8.2",
      scripts: ["next dev"],
      dependencies: {
        next: "16.2.12",
        react: "19.2.7",
        "react-dom": "19.2.7",
      },
      devDependencies: { typescript: "6.0.2" },
    };
    writeJson(path.join(unsafeScripts, "package.json"), manifest);
    const packageBefore = readFileSync(
      path.join(unsafeScripts, "package.json"),
      "utf8",
    );
    assert.throws(
      () =>
        runInitCommand({
          start: unsafeScripts,
          runtime: runtime([]),
        }),
      CliDiagnosticError,
    );
    assert.equal(
      readFileSync(path.join(unsafeScripts, "package.json"), "utf8"),
      packageBefore,
    );
    assert.equal(
      existsSync(path.join(unsafeScripts, "nextjshx.config.json")),
      false,
    );
  } finally {
    rmSync(unsafeScripts, { recursive: true, force: true });
  }
});

test("init requires the NextJsHx Haxe library before writing any baseline file", () => {
  const root = fixtureRoot();
  const requests: ProcessRequest[] = [];
  const failingRuntime = runtime(requests);
  try {
    const packageBefore = readFileSync(path.join(root, "package.json"), "utf8");
    assert.throws(
      () =>
        runInitCommand({
          start: root,
          runtime: {
            ...failingRuntime,
            processRunner: (request: ProcessRequest): ProcessResult => {
              requests.push(request);
              const libraryIndex = request.args.indexOf("-lib");
              const library =
                libraryIndex === -1
                  ? null
                  : request.args[libraryIndex + 1] ?? null;
              return Object.freeze({
                exitCode: library === "nextjshx" ? 1 : 0,
                stdout: request.args.includes("--version") ? "4.3.7\n" : "",
                stderr:
                  library === "nextjshx"
                    ? "Library nextjshx is not installed"
                    : "",
              });
            },
          },
        }),
      (error) => {
        assert(error instanceof CliDiagnosticError);
        assert.equal(error.diagnostic.code, "NXHX-CLI-INIT-0015");
        assert.match(error.diagnostic.message, /NextJsHx Haxe library/);
        return true;
      },
    );
    assert.equal(
      readFileSync(path.join(root, "package.json"), "utf8"),
      packageBefore,
    );
    assert.equal(
      existsSync(path.join(root, "nextjshx.config.json")),
      false,
    );
    assert.equal(existsSync(path.join(root, ".gitignore")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an interrupted init preserves a colliding temporary and an identical rerun completes safely", () => {
  const root = fixtureRoot();
  const requests: ProcessRequest[] = [];
  const fixedRuntime = runtime(requests);
  const temporary = path.join(
    root,
    "package.json.nextjshx-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.tmp",
  );
  try {
    const packageBefore = readFileSync(path.join(root, "package.json"), "utf8");
    writeFileSync(temporary, "native temporary bytes\n", "utf8");
    assert.throws(
      () => runInitCommand({ start: root, runtime: fixedRuntime }),
      /EEXIST/,
    );
    assert.equal(
      readFileSync(path.join(root, "package.json"), "utf8"),
      packageBefore,
    );
    assert.equal(readFileSync(temporary, "utf8"), "native temporary bytes\n");
    assert.equal(
      existsSync(path.join(root, "nextjshx.config.json")),
      true,
    );

    rmSync(temporary);
    const completed = runInitCommand({ start: root, runtime: fixedRuntime });
    assert.equal(completed.action, "initialized");
    assert.equal(
      readFileSync(path.join(root, "nextjshx.config.json"), "utf8").length >
        0,
      true,
    );
    assert.match(
      readFileSync(path.join(root, "package.json"), "utf8"),
      /"dev": "nextjshx dev --"/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test(
  "init never follows a symbolic-link Haxe parent",
  { skip: process.platform === "win32" },
  () => {
    const root = fixtureRoot();
    try {
      const outside = path.join(root, "outside");
      mkdirSync(outside);
      symlinkSync(outside, path.join(root, "haxe"));
      const result = runInitCommand({ start: root, runtime: runtime([]) });
      assert.equal(result.action, "partial");
      assert(
        result.files
          .filter((file) => file.path.startsWith("haxe/"))
          .every((file) => file.action === "preserved"),
      );
      assert.deepEqual(
        readFileSync(path.join(root, "package-lock.json"), "utf8"),
        `${JSON.stringify(
          { name: "init-fixture", lockfileVersion: 3 },
          null,
          2,
        )}\n`,
      );
      assert.equal(existsSync(path.join(outside, "NextJsHxMain.hx")), false);
      assert.equal(existsSync(path.join(outside, "nextjshx_app")), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);

test("init CLI exposes finite JSON output and rejects typed-routes on other commands", async () => {
  const root = fixtureRoot();
  try {
    let stdout = "";
    let stderr = "";
    const exitCode = await runCli(
      ["init", "--json"],
      {
        cwd: root,
        stdout: (value) => {
          stdout += value;
        },
        stderr: (value) => {
          stderr += value;
        },
      },
      runtime([]),
    );
    assert.equal(exitCode, 0);
    assert.equal(stderr, "");
    assert.match(stdout, /"command": "init"/);
    stdout = "";
    const invalid = await runCli(
      ["generate", "--typed-routes", "--json"],
      {
        cwd: root,
        stdout: (value) => {
          stdout += value;
        },
        stderr: (value) => {
          stderr += value;
        },
      },
      runtime([]),
    );
    assert.equal(invalid, 1);
    assert.equal(stdout, "");
    assert.match(stderr, /NXHX-CLI-USAGE-0001/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("init preserves native routes, scripts, executable config, and conflicting files", () => {
  const root = fixtureRoot({ nativePage: true });
  const requests: ProcessRequest[] = [];
  try {
    writeJson(path.join(root, "package.json"), {
      name: "init-fixture",
      private: true,
      packageManager: "npm@10.8.2",
      scripts: {
        dev: "next dev --turbopack",
      },
      dependencies: {
        next: "16.2.12",
        react: "19.2.7",
        "react-dom": "19.2.7",
      },
      devDependencies: { typescript: "6.0.2" },
    });
    const nextConfig =
      "export default async function config() { return { reactStrictMode: true }; }\n";
    writeFileSync(path.join(root, "next.config.mjs"), nextConfig, "utf8");
    writeFileSync(path.join(root, "nextjshx.hxml"), "# authored HXML\n", "utf8");
    const native = readFileSync(path.join(root, "src/app/page.tsx"), "utf8");

    const result = runInitCommand({
      start: root,
      typedRoutes: true,
      runtime: runtime(requests),
    });
    assert.equal(result.action, "partial");
    assert.equal(result.typedRoutes, "manual");
    assert.match(
      readFileSync(path.join(root, "nextjshx.config.json"), "utf8"),
      /"typedRoutes": false/,
    );
    assert.equal(
      result.scripts.find((script) => script.name === "dev")?.action,
      "preserved",
    );
    assert.equal(
      result.files.find((file) => file.path === "nextjshx.hxml")?.action,
      "preserved",
    );
    assert.equal(
      existsSync(path.join(root, "haxe/nextjshx_app/HomePage.hx")),
      false,
    );
    assert.equal(readFileSync(path.join(root, "src/app/page.tsx"), "utf8"), native);
    assert.equal(readFileSync(path.join(root, "next.config.mjs"), "utf8"), nextConfig);
    assert.equal(
      readFileSync(path.join(root, "nextjshx.hxml"), "utf8"),
      "# authored HXML\n",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("explicit typed routes creates matching Next and NextJsHx configuration", () => {
  const root = fixtureRoot();
  try {
    const result = runInitCommand({
      start: root,
      typedRoutes: true,
      runtime: runtime([]),
    });
    assert.equal(result.typedRoutes, "enabled");
    assert.match(
      readFileSync(path.join(root, "next.config.mjs"), "utf8"),
      /typedRoutes: true/,
    );
    assert.match(
      readFileSync(path.join(root, "nextjshx.config.json"), "utf8"),
      /"typedRoutes": true/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("typed routes preserves a disabled existing NextJsHx configuration without creating a Next config", () => {
  const root = fixtureRoot();
  try {
    const first = runInitCommand({ start: root, runtime: runtime([]) });
    assert.equal(first.typedRoutes, "disabled");
    const configBefore = readFileSync(
      path.join(root, "nextjshx.config.json"),
      "utf8",
    );
    assert.equal(existsSync(path.join(root, "next.config.mjs")), false);

    const second = runInitCommand({
      start: root,
      typedRoutes: true,
      runtime: runtime([]),
    });
    assert.equal(second.typedRoutes, "manual");
    assert.equal(second.action, "unchanged");
    assert.equal(existsSync(path.join(root, "next.config.mjs")), false);
    assert.equal(
      readFileSync(path.join(root, "nextjshx.config.json"), "utf8"),
      configBefore,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the generated new-app baseline compiles and publishes through the real Haxe toolchain", async () => {
  const root = fixtureRoot();
  try {
    const libraries = path.join(root, "haxe_libraries");
    mkdirSync(libraries);
    copyFileSync(
      path.join(REPOSITORY_ROOT, "haxe_libraries/genes-ts.hxml"),
      path.join(libraries, "genes-ts.hxml"),
    );
    copyFileSync(
      path.join(REPOSITORY_ROOT, "haxe_libraries/helder.set.hxml"),
      path.join(libraries, "helder.set.hxml"),
    );
    writeJson(path.join(root, ".haxerc"), {
      version: "4.3.7",
      resolveLibs: "scoped",
    });
    writeFileSync(
      path.join(libraries, "nextjshx.hxml"),
      [
        "# Test-only project-local stand-in for an installed NextJsHx Lix scope.",
        `-cp ${path.join(REPOSITORY_ROOT, "src")}`,
        "-D nextjshx=0.0.0-development",
        "",
      ].join("\n"),
      "utf8",
    );

    const initialized = runInitCommand({ start: root });
    assert.equal(initialized.action, "initialized");
    const generated = await runGenerateCommand({
      start: root,
      validate: false,
    });
    assert.equal(generated.validation, "skipped");
    assert.deepEqual(generated.blocked, []);
    assert.equal(
      existsSync(path.join(root, "src/app/page.tsx")),
      true,
    );
    assert.equal(
      existsSync(path.join(root, ".nextjshx/manifest.json")),
      true,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
