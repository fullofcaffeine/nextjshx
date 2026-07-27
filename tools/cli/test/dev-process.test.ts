import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import test from "node:test";

import {
  startManagedProcess,
  type DevOutputEvent,
} from "../src/index.js";

async function eventually(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 3_000;
  while (!condition()) {
    if (Date.now() >= deadline) {
      assert.fail("process condition did not become true before the test deadline");
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !(
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ESRCH"
    );
  }
}

test(
  "managed cleanup terminates its process group without touching an unrelated child",
  { skip: process.platform === "win32" },
  async () => {
    const events: DevOutputEvent[] = [];
    const unrelated = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      detached: true,
      stdio: "ignore",
    });
    const unrelatedPid = unrelated.pid;
    if (unrelatedPid === undefined) {
      assert.fail("unrelated fixture process did not receive a pid");
    }
    const managed = startManagedProcess(
      {
        command: process.execPath,
        args: [
          "-e",
          [
            "const { spawn } = require('node:child_process');",
            "const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });",
            "process.stdout.write(String(child.pid) + '\\n');",
            "setInterval(() => {}, 1000);",
          ].join(" "),
        ],
        cwd: process.cwd(),
        source: "next",
        cleanupMs: 500,
      },
      (event) => events.push(event),
    );
    try {
      await eventually(() => events.some((event) => /^\d+$/.test(event.line)));
      const pidLine = events.find((event) => /^\d+$/.test(event.line));
      assert.notEqual(pidLine, undefined);
      const descendantPid = Number(pidLine?.line);
      assert(Number.isInteger(descendantPid));
      assert.equal(isAlive(descendantPid), true);
      assert.equal(isAlive(unrelatedPid), true);

      await managed.stop();
      await eventually(() => !isAlive(managed.pid) && !isAlive(descendantPid));
      assert.equal(isAlive(unrelatedPid), true, "cleanup is scoped to the owned process group");
      const result = await managed.exit;
      assert.equal(result.signal, "SIGTERM");
      assert.equal(result.code, 143);
    } finally {
      if (isAlive(unrelatedPid)) {
        process.kill(-unrelatedPid, "SIGKILL");
      }
      await new Promise<void>((resolve) => unrelated.once("exit", () => resolve()));
    }
  },
);

test("managed output preserves source and channel while joining partial lines", async () => {
  const events: DevOutputEvent[] = [];
  const managed = startManagedProcess(
    {
      command: process.execPath,
      args: [
        "-e",
        "process.stdout.write('ready'); process.stdout.write(' now\\n'); process.stderr.write('typed error');",
      ],
      cwd: process.cwd(),
      source: "haxe",
    },
    (event) => events.push(event),
  );
  const result = await managed.exit;
  assert.equal(result.code, 0);
  assert.deepEqual(events, [
    { source: "haxe", channel: "stdout", line: "ready now" },
    { source: "haxe", channel: "stderr", line: "typed error" },
  ]);
});

test("a failed spawn is rejected without leaking an uncaught child error", async () => {
  const missing = path.join(process.cwd(), `.nextjshx-missing-command-${process.pid}`);
  assert.throws(
    () => startManagedProcess(
      {
        command: missing,
        args: [],
        cwd: process.cwd(),
        source: "next",
      },
      () => undefined,
    ),
    /child process has no pid/,
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
});
