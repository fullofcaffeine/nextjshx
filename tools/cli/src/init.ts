import { createHash, randomUUID } from "node:crypto";
import {
  constants,
  closeSync,
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import {
  CONFIG_FILE_NAME,
  CONFIG_SCHEMA_ID,
  CONFIG_SCHEMA_VERSION,
} from "./config.js";
import { cliFailure } from "./cli-diagnostic.js";
import { discoverNextProject } from "./discovery.js";
import {
  type ProcessRequest,
  type ProcessResult,
  type ProcessRunner,
  runProcess,
} from "./process.js";

type JsonValue =
  | boolean
  | number
  | string
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

interface InitRuntime {
  readonly processRunner?: ProcessRunner;
  readonly haxeCommand?: {
    readonly command: string;
    readonly argsPrefix: readonly string[];
  };
  readonly uuid?: () => string;
}

export interface InitCommandOptions {
  readonly start: string;
  readonly typedRoutes?: boolean;
  readonly runtime?: InitRuntime;
}

export interface InitFileReport {
  readonly path: string;
  readonly action: "created" | "updated" | "unchanged" | "preserved";
  readonly reason: string;
}

export interface InitScriptReport {
  readonly name: "dev" | "generate" | "typecheck";
  readonly action: "added" | "unchanged" | "preserved";
  readonly previous: string | null;
  readonly proposed: string;
}

export interface InitCommandResult {
  readonly command: "init";
  readonly projectRoot: string;
  readonly packageManager: string;
  readonly appRoot: string;
  readonly action: "initialized" | "unchanged" | "partial";
  readonly files: readonly InitFileReport[];
  readonly scripts: readonly InitScriptReport[];
  readonly typedRoutes: "disabled" | "enabled" | "manual";
  readonly followUp: readonly string[];
}

const DESIRED_SCRIPTS = Object.freeze({
  dev: "nextjshx dev --",
  generate: "nextjshx generate",
  typecheck: "nextjshx typecheck",
});
const SCRIPT_NAMES: readonly InitScriptReport["name"][] = Object.freeze([
  "dev",
  "generate",
  "typecheck",
]);

function isJsonObject(
  value: unknown,
): value is { readonly [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function initFailure(
  message: string,
  target: string,
  expected: string,
  actual: string,
  resolution: string,
): never {
  cliFailure(
    "NXHX-CLI-INIT-0015",
    message,
    target,
    expected,
    actual,
    resolution,
  );
}

function readJsonObject(file: string): { readonly [key: string]: JsonValue } {
  // package.json is an external JSON boundary. Keep the decoded value broad
  // only until this immediate object check, then retain the closed JSON-value
  // model while inspecting the two fields init supports.
  let decoded: unknown;
  try {
    decoded = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    initFailure(
      "Init cannot parse package metadata safely.",
      path.basename(file),
      "a strict JSON object",
      error instanceof Error ? error.message : "malformed JSON",
      "Repair package.json before initializing NextJsHx.",
    );
  }
  if (!isJsonObject(decoded)) {
    initFailure(
      "Init requires object-shaped package metadata.",
      path.basename(file),
      "a JSON object",
      Array.isArray(decoded) ? "array" : typeof decoded,
      "Repair package.json before initializing NextJsHx.",
    );
  }
  return decoded;
}

function commandResult(
  runner: ProcessRunner,
  request: ProcessRequest,
  subject: string,
): ProcessResult {
  const result = runner(request);
  if (result.exitCode !== 0) {
    initFailure(
      `Init cannot verify ${subject}.`,
      request.command,
      "a successful non-interactive capability probe",
      result.stderr.trim() || `exit ${result.exitCode}`,
      `Install the pinned ${subject} capability before rerunning init.`,
    );
  }
  return result;
}

function verifyToolchain(
  root: string,
  workspaceRoot: string,
  runtime: InitRuntime | undefined,
): void {
  const runner = runtime?.processRunner ?? runProcess;
  const haxe = runtime?.haxeCommand ?? { command: "haxe", argsPrefix: [] };
  commandResult(
    runner,
    {
      command: haxe.command,
      args: [...haxe.argsPrefix, "--version"],
      cwd: root,
      source: "haxe",
    },
    "Haxe",
  );
  commandResult(
    runner,
    {
      command: haxe.command,
      args: [
        ...haxe.argsPrefix,
        "-lib",
        "genes-ts",
        "-js",
        ".nextjshx/init-capability-probe.js",
        "--no-output",
      ],
      cwd: root,
      source: "haxe",
    },
    "genes-ts",
  );
  commandResult(
    runner,
    {
      command: haxe.command,
      args: [
        ...haxe.argsPrefix,
        "-lib",
        "nextjshx",
        "-js",
        ".nextjshx/init-capability-probe.js",
        "--no-output",
      ],
      cwd: root,
      source: "haxe",
    },
    "NextJsHx Haxe library",
  );
  const typescriptManifest = [root, workspaceRoot]
    .map((candidate) =>
      path.join(candidate, "node_modules/typescript/package.json"),
    )
    .find((candidate) => existsSync(candidate));
  if (typescriptManifest === undefined) {
    initFailure(
      "Init cannot verify the TypeScript installation.",
      "typescript",
      "an installed TypeScript package in the application or workspace",
      "missing node_modules/typescript/package.json",
      "Install the project lockfile before rerunning init.",
    );
  }
  const typescriptStats = lstatSync(typescriptManifest);
  if (!typescriptStats.isFile() || typescriptStats.isSymbolicLink()) {
    initFailure(
      "Init refuses an unsafe TypeScript package manifest.",
      path.relative(root, typescriptManifest),
      "a real regular package.json",
      typescriptStats.isSymbolicLink() ? "symbolic link" : "non-regular entry",
      "Reinstall the project lockfile before rerunning init.",
    );
  }
}

function templateFiles(
  appRoot: string,
  createExample: boolean,
  typedRoutes: boolean,
): ReadonlyMap<string, string> {
  const values = new Map<string, string>([
    [
      CONFIG_FILE_NAME,
      `${JSON.stringify(
        {
          $schema: CONFIG_SCHEMA_ID,
          schemaVersion: CONFIG_SCHEMA_VERSION,
          appRoot,
          haxe: {
            hxml: "nextjshx.hxml",
            generatedRoot: "src-gen",
            defines: [
              "genes.ts",
              "genes.ts.no_extension",
              "genes.ts.jsx_import_source=react",
            ],
          },
          next: { package: "next", typedRoutes },
          output: {
            manifest: ".nextjshx/manifest.json",
            format: "project",
          },
        },
        null,
        2,
      )}\n`,
    ],
    [
      "nextjshx.hxml",
      [
        "-lib genes-ts",
        "-lib nextjshx",
        "-cp haxe",
        "--main NextJsHxMain",
        "-js src-gen/index.tsx",
        "",
        "--macro nextjshx_app.AdapterPlan.install()",
        "--macro include('nextjshx_app')",
        "-dce full",
        "",
      ].join("\n"),
    ],
    [
      "haxe/NextJsHxMain.hx",
      "class NextJsHxMain {\n\tpublic static function main():Void {}\n}\n",
    ],
    [
      "haxe/nextjshx_app/AdapterPlan.hx",
      [
        "package nextjshx_app;",
        "",
        "#if macro",
        "import haxe.macro.Expr;",
        "import nextjshx.adapter.AdapterPlanRegistry;",
        "import nextjshx.app.PageLayoutMacro;",
        "",
        "class AdapterPlan {",
        "\tpublic static macro function install():Expr {",
        '\t\tAdapterPlanRegistry.install(".nextjshx/default-plan.json", "0.0.0-development", "4.3.7", "1.38.2+f0ffa29e6d49fe81541977c6a3aae6b80000cec6", "16.2.12");',
        "\t\tPageLayoutMacro.install();",
        "\t\treturn macro null;",
        "\t}",
        "}",
        "#end",
        "",
      ].join("\n"),
    ],
  ]);
  if (createExample) {
    values.set(
      "haxe/nextjshx_app/HomePage.hx",
      [
        "package nextjshx_app;",
        "",
        "import genes.react.Element;",
        "import nextjs.app.PageProps;",
        "import nextjs.route.NoParams;",
        "import nextjs.route.SearchParams;",
        "",
        '@:next.page("")',
        "class HomePage {",
        "\tpublic static function render(_:PageProps<NoParams, SearchParams>):Element {",
        '\t\treturn <main><h1>Welcome to NextJsHx</h1><p>Edit haxe/nextjshx_app/HomePage.hx to begin.</p></main>;',
        "\t}",
        "}",
        "",
      ].join("\n"),
    );
  }
  return values;
}

function fileReport(
  root: string,
  relative: string,
  content: string,
): InitFileReport {
  const absolute = path.join(root, ...relative.split("/"));
  if (existsSync(absolute)) {
    const stats = lstatSync(absolute);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      return Object.freeze({
        path: relative,
        action: "preserved",
        reason: stats.isSymbolicLink()
          ? "existing symbolic link"
          : "existing non-regular entry",
      });
    }
    const existing = readFileSync(absolute, "utf8");
    return Object.freeze({
      path: relative,
      action: existing === content ? "unchanged" : "preserved",
      reason:
        existing === content
          ? "already matches the initializer"
          : "existing authored bytes differ",
    });
  }
  let parent = root;
  for (const segment of relative.split("/").slice(0, -1)) {
    parent = path.join(parent, segment);
    if (existsSync(parent)) {
      const stats = lstatSync(parent);
      if (stats.isSymbolicLink() || !stats.isDirectory()) {
        return Object.freeze({
          path: relative,
          action: "preserved",
          reason: `${path.relative(root, parent)} is ${
            stats.isSymbolicLink() ? "a symbolic link" : "not a directory"
          }`,
        });
      }
    } else {
      mkdirSync(parent, { mode: 0o755 });
    }
  }
  let descriptor: number;
  try {
    descriptor = openSync(
      absolute,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
      0o644,
    );
  } catch (error) {
    initFailure(
      "An initializer target appeared before its exclusive create.",
      relative,
      "an absent path",
      error instanceof Error ? error.message : "filesystem collision",
      "Preserve the concurrent entry, inspect it, and rerun init.",
    );
  }
  try {
    writeFileSync(descriptor, content, "utf8");
  } finally {
    closeSync(descriptor);
  }
  return Object.freeze({
    path: relative,
    action: "created",
    reason: "path was absent",
  });
}

function scriptPatch(
  packageJson: { readonly [key: string]: JsonValue },
): {
  readonly reports: readonly InitScriptReport[];
  readonly updated: { readonly [key: string]: JsonValue };
  readonly changed: boolean;
} {
  if (
    packageJson.scripts !== undefined &&
    !isJsonObject(packageJson.scripts)
  ) {
    initFailure(
      "Init cannot patch non-object package scripts.",
      "package.json#scripts",
      "an object of script names to command strings",
      Array.isArray(packageJson.scripts)
        ? "array"
        : typeof packageJson.scripts,
      "Repair the scripts field before rerunning init; no package metadata was changed.",
    );
  }
  const currentScripts = isJsonObject(packageJson.scripts)
    ? packageJson.scripts
    : {};
  const nextScripts: { [key: string]: JsonValue } = { ...currentScripts };
  const reports: InitScriptReport[] = [];
  let changed = false;
  for (const name of SCRIPT_NAMES) {
    const proposed = DESIRED_SCRIPTS[name];
    const current = currentScripts[name];
    if (current === undefined) {
      nextScripts[name] = proposed;
      changed = true;
      reports.push({
        name,
        action: "added",
        previous: null,
        proposed,
      });
    } else if (current === proposed) {
      reports.push({
        name,
        action: "unchanged",
        previous: current,
        proposed,
      });
    } else {
      reports.push({
        name,
        action: "preserved",
        previous: typeof current === "string" ? current : JSON.stringify(current),
        proposed,
      });
    }
  }
  return Object.freeze({
    reports: Object.freeze(reports),
    updated: Object.freeze({ ...packageJson, scripts: nextScripts }),
    changed,
  });
}

function atomicJsonPatch(
  file: string,
  previousBytes: string,
  value: { readonly [key: string]: JsonValue },
  uuid: () => string,
): void {
  const previousMode = lstatSync(file).mode & 0o777;
  if (sha256(readFileSync(file, "utf8")) !== sha256(previousBytes)) {
    initFailure(
      "package.json changed during initialization.",
      "package.json",
      sha256(previousBytes),
      "different current bytes",
      "Preserve the concurrent edit and rerun init.",
    );
  }
  const temporary = `${file}.nextjshx-${uuid()}.tmp`;
  let temporaryCreated = false;
  try {
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    temporaryCreated = true;
    if (sha256(readFileSync(file, "utf8")) !== sha256(previousBytes)) {
      initFailure(
        "package.json changed before the initialization patch was published.",
        "package.json",
        sha256(previousBytes),
        "different current bytes",
        "Preserve the concurrent edit and rerun init.",
      );
    }
    chmodSync(temporary, previousMode);
    renameSync(temporary, file);
  } finally {
    if (temporaryCreated) {
      rmSync(temporary, { force: true });
    }
  }
}

function gitignoreReport(
  root: string,
  generatedRoot: string,
  uuid: () => string,
): InitFileReport {
  const relative = ".gitignore";
  const absolute = path.join(root, relative);
  const required = [".next/", ".nextjshx/", `${generatedRoot}/`];
  if (existsSync(absolute)) {
    const stats = lstatSync(absolute);
    if (stats.isSymbolicLink() || !stats.isFile()) {
      return Object.freeze({
        path: relative,
        action: "preserved",
        reason: stats.isSymbolicLink()
          ? "existing symbolic link"
          : "existing non-regular entry",
      });
    }
  }
  const previous = existsSync(absolute) ? readFileSync(absolute, "utf8") : "";
  const previousMode = existsSync(absolute)
    ? lstatSync(absolute).mode & 0o777
    : 0o644;
  const present = new Set(
    previous.split(/\r?\n/).map((line) => line.trim()),
  );
  const missing = required.filter((entry) => !present.has(entry));
  if (missing.length === 0) {
    return Object.freeze({
      path: relative,
      action: "unchanged",
      reason: "all generated roots are ignored",
    });
  }
  const prefix = previous.length === 0 || previous.endsWith("\n") ? "" : "\n";
  const block = `${prefix}\n# NextJsHx generated and transactional output\n${missing.join("\n")}\n`;
  const temporary = `${absolute}.nextjshx-${uuid()}.tmp`;
  let temporaryCreated = false;
  try {
    writeFileSync(temporary, `${previous}${block}`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    temporaryCreated = true;
    const current = existsSync(absolute) ? readFileSync(absolute, "utf8") : "";
    if (current !== previous) {
      initFailure(
        ".gitignore changed during initialization.",
        relative,
        sha256(previous),
        sha256(current),
        "Preserve the concurrent edit and rerun init.",
      );
    }
    chmodSync(temporary, previousMode);
    renameSync(temporary, absolute);
  } finally {
    if (temporaryCreated) {
      rmSync(temporary, { force: true });
    }
  }
  return Object.freeze({
    path: relative,
    action: previous.length === 0 ? "created" : "updated",
    reason: `added ${missing.join(", ")}`,
  });
}

function typedRoutesReport(
  root: string,
  requested: boolean,
): {
  readonly status: InitCommandResult["typedRoutes"];
  readonly file: InitFileReport | null;
} {
  if (!requested) {
    return Object.freeze({ status: "disabled", file: null });
  }
  const candidates = [
    "next.config.js",
    "next.config.mjs",
    "next.config.ts",
    "next.config.mts",
  ];
  const existing = candidates.filter((candidate) =>
    existsSync(path.join(root, candidate)),
  );
  if (existing.length === 0) {
    const relative = "next.config.mjs";
    return Object.freeze({
      status: "enabled",
      file: fileReport(
        root,
        relative,
        "const nextConfig = {\n  typedRoutes: true,\n};\n\nexport default nextConfig;\n",
      ),
    });
  }
  return Object.freeze({
    status: "manual",
    file: Object.freeze({
      path: existing.join(", "),
      action: "preserved",
      reason:
        "existing executable Next config requires a manual reviewed typedRoutes patch",
    }),
  });
}

export function runInitCommand(options: InitCommandOptions): InitCommandResult {
  const discovery = discoverNextProject(options.start, { requireConfig: false });
  if (discovery.config !== null) {
    // Parsing during discovery proves an existing config is valid. Init remains
    // useful for idempotently filling absent scripts and ignore entries.
  }
  const tsconfig = path.join(discovery.packageRoot, "tsconfig.json");
  if (!existsSync(tsconfig) || !lstatSync(tsconfig).isFile()) {
    initFailure(
      "Init requires an existing TypeScript Next.js application.",
      "tsconfig.json",
      "a real regular TypeScript project file",
      "missing or non-regular",
      "Initialize the Next.js App Router TypeScript application first.",
    );
  }
  verifyToolchain(
    discovery.packageRoot,
    discovery.workspaceRoot,
    options.runtime,
  );

  const packageStats = lstatSync(discovery.packageJsonPath);
  if (packageStats.isSymbolicLink() || !packageStats.isFile()) {
    initFailure(
      "Init refuses unsafe package metadata.",
      "package.json",
      "a real regular file",
      packageStats.isSymbolicLink() ? "symbolic link" : "non-regular entry",
      "Replace the entry with reviewed package metadata inside the application.",
    );
  }
  const packageBytes = readFileSync(discovery.packageJsonPath, "utf8");
  const packageJson = readJsonObject(discovery.packageJsonPath);
  const scripts = scriptPatch(packageJson);

  const typedRoutes: ReturnType<typeof typedRoutesReport> =
    options.typedRoutes === true &&
    discovery.config !== null &&
    discovery.config.next.typedRoutes === false
      ? Object.freeze({
          status: "manual",
          file: null,
        })
      : typedRoutesReport(
          discovery.packageRoot,
          options.typedRoutes ?? false,
        );
  const hasNativePage = ["js", "jsx", "ts", "tsx"].some((extension) =>
    existsSync(path.join(discovery.appRoot, `page.${extension}`)),
  );
  const templates =
    discovery.config === null
      ? templateFiles(
          discovery.appRootRelative,
          !hasNativePage,
          typedRoutes.status === "enabled",
        )
      : new Map<string, string>();
  const files = [...templates].map(([relative, content]) =>
    fileReport(discovery.packageRoot, relative, content),
  );
  if (discovery.config !== null && discovery.configPath !== null) {
    files.push(
      Object.freeze({
        path: path.relative(discovery.packageRoot, discovery.configPath),
        action: "unchanged",
        reason: "existing valid NextJsHx configuration",
      }),
    );
  }
  files.push(
    gitignoreReport(
      discovery.packageRoot,
      discovery.config?.haxe.generatedRoot ?? "src-gen",
      options.runtime?.uuid ?? randomUUID,
    ),
  );
  if (typedRoutes.file !== null) {
    files.push(typedRoutes.file);
  }
  // Publish the package patch last. Init is a monotonic absent-only workflow,
  // so an interruption before this point can be completed by an identical
  // rerun without having redirected the package's ordinary commands.
  if (scripts.changed) {
    atomicJsonPatch(
      discovery.packageJsonPath,
      packageBytes,
      scripts.updated,
      options.runtime?.uuid ?? randomUUID,
    );
  }
  const preserved = files.filter((file) => file.action === "preserved");
  const created =
    files.some(
      (file) => file.action === "created" || file.action === "updated",
    ) || scripts.changed;
  const manager = discovery.packageManager.name;
  return Object.freeze({
    command: "init",
    projectRoot: discovery.packageRoot,
    packageManager: manager,
    appRoot: discovery.appRootRelative,
    action:
      preserved.length > 0
        ? "partial"
        : created
          ? "initialized"
          : "unchanged",
    files: Object.freeze(files),
    scripts: scripts.reports,
    typedRoutes: typedRoutes.status,
    followUp: Object.freeze([
      `${manager} run generate`,
      `${manager} run typecheck`,
      `${manager} run dev`,
    ]),
  });
}
