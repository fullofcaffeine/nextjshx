import { spawnSync } from "node:child_process";

import { cliFailure } from "./cli-diagnostic.js";

export interface ProcessRequest {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly source: "git" | "haxe" | "next" | "next-build" | "tsc";
}

export interface ProcessResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export type ProcessRunner = (request: ProcessRequest) => ProcessResult;

export const runProcess: ProcessRunner = (request) => {
  const result = spawnSync(request.command, [...request.args], {
    cwd: request.cwd,
    encoding: "utf8",
    env: { ...process.env, ...request.env, NO_COLOR: "1" },
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
  });
  if (result.error !== undefined) {
    cliFailure(
      "NXHX-CLI-PROCESS-0002",
      `Cannot start the ${request.source} process.`,
      request.source,
      "an installed executable launched without a shell",
      `${(result.error as NodeJS.ErrnoException).code ?? "process error"}: ` +
        `${request.source} executable unavailable`,
      `Install the configured ${request.source} toolchain and retry from the application package.`,
    );
  }
  return Object.freeze({
    exitCode: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  });
};

export function processOutput(result: ProcessResult): string {
  return `${result.stdout}${result.stderr}`.trim();
}
