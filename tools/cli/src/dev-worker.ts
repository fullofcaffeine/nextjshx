import { parentPort, workerData } from "node:worker_threads";

import {
  commandErrorJson,
  runGenerateCommand,
  type GenerateCommandResult,
  type ToolCommand,
} from "./commands.js";
import { runProcess } from "./process.js";

interface DevWorkerInput {
  readonly start: string;
  readonly configPath?: string;
  readonly haxeCommand: ToolCommand;
}

export type DevWorkerMessage =
  | {
      readonly kind: "output";
      readonly channel: "stdout" | "stderr";
      readonly value: string;
    }
  | {
      readonly kind: "success";
      readonly result: GenerateCommandResult;
    }
  | {
      readonly kind: "failure";
      readonly message: string;
      readonly diagnostic: object;
    };

function decodeInput(value: unknown): DevWorkerInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("development worker input must be an object");
  }
  const record = value as Record<string, unknown>;
  const command = record.haxeCommand;
  if (
    typeof record.start !== "string" ||
    (record.configPath !== undefined && typeof record.configPath !== "string") ||
    typeof command !== "object" ||
    command === null ||
    Array.isArray(command)
  ) {
    throw new Error("development worker input has an invalid command shape");
  }
  const commandRecord = command as Record<string, unknown>;
  if (
    typeof commandRecord.command !== "string" ||
    !Array.isArray(commandRecord.argsPrefix) ||
    !commandRecord.argsPrefix.every((entry) => typeof entry === "string")
  ) {
    throw new Error("development worker Haxe command is invalid");
  }
  return Object.freeze({
    start: record.start,
    ...(typeof record.configPath === "string" ? { configPath: record.configPath } : {}),
    haxeCommand: Object.freeze({
      command: commandRecord.command,
      argsPrefix: Object.freeze([...commandRecord.argsPrefix] as string[]),
    }),
  });
}

function post(message: DevWorkerMessage): void {
  if (parentPort === null) {
    throw new Error("development worker has no parent port");
  }
  parentPort.postMessage(message);
}

async function main(): Promise<void> {
  const input = decodeInput(workerData);
  try {
    const result = await runGenerateCommand({
      start: input.start,
      ...(input.configPath === undefined ? {} : { configPath: input.configPath }),
      validate: false,
      runtime: {
        haxeCommand: input.haxeCommand,
        processRunner: (request) => {
          const result = runProcess(request);
          if (result.stdout.length > 0) {
            post({ kind: "output", channel: "stdout", value: result.stdout });
          }
          if (result.stderr.length > 0) {
            post({ kind: "output", channel: "stderr", value: result.stderr });
          }
          return result;
        },
      },
    });
    post({ kind: "success", result });
  } catch (error) {
    const diagnostic = commandErrorJson(error);
    post({
      kind: "failure",
      message: error instanceof Error ? error.message : "unknown development generation failure",
      diagnostic: typeof diagnostic === "object" && diagnostic !== null
        ? diagnostic
        : Object.freeze({ code: "NXHX-CLI-PROCESS-0002" }),
    });
  }
}

await main();
