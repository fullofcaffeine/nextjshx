import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { expect, test as base } from "@playwright/test";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EXAMPLE = path.join(ROOT, "examples/todoapp-next");
const CONTROL = path.join(EXAMPLE, ".nextjshx");
const NEXT_BIN = path.join(ROOT, "node_modules/next/dist/bin/next");
const LINKED_PACKAGES = [
  "@dnd-kit/helpers",
  "@dnd-kit/react",
  "@nextjshx/showcase-ui",
  "@tailwindcss/cli",
  "next",
  "nuqs",
  "react",
  "react-dom",
  "react-is",
  "recharts",
  "tailwindcss",
  "typescript",
];
const SMOKE_STATE = `id\tcompleted\tpriority\ttitle\tnote
shape-first-release\tfalse\tP0\tRuntime state won the read\tThe production server reopened the isolated state file instead of freezing seed bytes.
prove-production-build\ttrue\tP1\tProve the production build\tKeep Next typegen and the framework build as independent verifiers.
write-adoption-guide\tfalse\tP2\tWrite the adoption guide\tShow where Haxe improves authoring while native Next behavior stays visible.
`;
const RECOVERABLE_ERROR = "FIELD_LEDGER_RECOVERABLE_RENDER";
const HYDRATION_DIAGNOSTIC = /hydrat|server rendered|did not match/i;

function parseState(source) {
  const normalized = source.replaceAll("\r\n", "\n");
  expect(normalized).not.toContain("\r");
  const lines = normalized.endsWith("\n")
    ? normalized.slice(0, -1).split("\n")
    : normalized.split("\n");
  expect(lines[0]).toBe("id\tcompleted\tpriority\ttitle\tnote");
  const records = lines.slice(1).map((line) => {
    const fields = line.split("\t");
    expect(fields).toHaveLength(5);
    const [id, completed, priority, title, note] = fields;
    expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(["true", "false"]).toContain(completed);
    expect(["P0", "P1", "P2"]).toContain(priority);
    return { id, completed: completed === "true", priority, title, note };
  });
  expect(new Set(records.map((record) => record.id)).size).toBe(records.length);
  return records;
}

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("could not reserve a loopback port");
  }
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return address.port;
}

async function waitForServer(baseURL) {
  const deadline = Date.now() + 30_000;
  let lastError = new Error("production server did not answer");
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseURL, {
        headers: { accept: "text/html" },
        signal: AbortSignal.timeout(2_000),
      });
      if (response.ok) {
        return;
      }
      lastError = new Error(`production server returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw lastError;
}

async function stopServer(child, exitPromise) {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    await Promise.race([exitPromise, new Promise((resolve) => setTimeout(resolve, 5_000))]);
  }
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await exitPromise;
  }
}

async function linkWorkspaceDependencies() {
  const created = [];
  for (const name of LINKED_PACKAGES) {
    const source = path.join(ROOT, "node_modules", name);
    const destination = path.join(EXAMPLE, "node_modules", name);
    await fs.access(path.join(source, "package.json"));
    try {
      await fs.lstat(destination);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.symlink(source, destination, "dir");
      created.push(destination);
    }
  }
  return created;
}

async function removeFixtureLinks(created) {
  for (const link of created.reverse()) {
    await fs.rm(link, { force: true });
  }
  for (const scope of ["@dnd-kit", "@nextjshx", "@tailwindcss"]) {
    await fs.rmdir(path.join(EXAMPLE, "node_modules", scope)).catch((error) => {
      if (error.code !== "ENOENT" && error.code !== "ENOTEMPTY") {
        throw error;
      }
    });
  }
  await fs.rmdir(path.join(EXAMPLE, "node_modules")).catch((error) => {
    if (error.code !== "ENOENT" && error.code !== "ENOTEMPTY") {
      throw error;
    }
  });
}

function observeDiagnostics(page) {
  const errors = [];
  const hydration = [];
  const failedRequests = [];
  const badResponses = [];
  const allowedErrorMarkers = new Set();
  const allowedResponses = new Set();
  const allowedAbortedRscPaths = new Set();
  const allowedAbortedActionPaths = new Set();

  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    const rendered = `${message.type()}: ${message.text()}`;
    if (HYDRATION_DIAGNOSTIC.test(message.text())) {
      hydration.push(rendered);
    }
    if (message.type() === "error") {
      errors.push(rendered);
    }
  });
  page.on("requestfailed", (request) => {
    failedRequests.push({
      method: request.method(),
      url: request.url(),
      error: request.failure()?.errorText ?? "failed",
    });
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      const url = new URL(response.url());
      badResponses.push(`${response.status()} ${url.pathname}`);
    }
  });

  return {
    allowError(marker) {
      allowedErrorMarkers.add(marker);
    },
    allowResponse(status, pathname) {
      allowedResponses.add(`${status} ${pathname}`);
    },
    allowAbortedRsc(pathname) {
      allowedAbortedRscPaths.add(pathname);
    },
    allowAbortedAction(pathname) {
      allowedAbortedActionPaths.add(pathname);
    },
    verify() {
      const unexpectedErrors = errors.filter(
        (message) => ![...allowedErrorMarkers].some((marker) => message.includes(marker)),
      );
      const unexpectedResponses = badResponses.filter((response) => !allowedResponses.has(response));
      const unexpectedFailedRequests = failedRequests.filter((failure) => {
        const url = new URL(failure.url);
        const expectedRscAbort =
          failure.method === "GET" &&
          failure.error === "net::ERR_ABORTED" &&
          url.searchParams.has("_rsc") &&
          allowedAbortedRscPaths.has(url.pathname);
        const expectedActionAbort =
          failure.method === "POST" &&
          failure.error === "net::ERR_ABORTED" &&
          allowedAbortedActionPaths.has(url.pathname);
        return !(expectedRscAbort || expectedActionAbort);
      });
      expect(hydration, `hydration diagnostics: ${hydration.join(" | ")}`).toEqual([]);
      expect(unexpectedErrors, `browser errors: ${unexpectedErrors.join(" | ")}`).toEqual([]);
      expect(
        unexpectedFailedRequests,
        `failed requests: ${unexpectedFailedRequests
          .map((failure) => `${failure.method} ${failure.url} ${failure.error}`)
          .join(" | ")}`,
      ).toEqual([]);
      expect(unexpectedResponses, `failed responses: ${unexpectedResponses.join(" | ")}`).toEqual([]);
    },
  };
}

async function todoOrder(page) {
  return page.locator("#todo-list-page:visible .todo-link").allTextContents();
}

async function pointerReorder(page, sourceName, targetTitle) {
  const source = page.getByRole("button", { name: `Reorder ${sourceName}` });
  const target = page
    .locator("#todo-list-page:visible .todo-row")
    .filter({ hasText: targetTitle });
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await expect(source).toHaveAttribute("aria-pressed", "true");
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
    steps: 14,
  });
  await page.mouse.up();
}

async function failNextServerActionAfterCommit(page, diagnostics) {
  const pattern = "**/*";
  let intercepted = false;
  diagnostics.allowResponse(503, "/");
  diagnostics.allowError("Failed to load resource: the server responded with a status of 503");
  diagnostics.allowAbortedAction("/");
  diagnostics.allowAbortedRsc("/");
  const handler = async (route) => {
    const request = route.request();
    if (intercepted || request.method() !== "POST" || request.headers()["next-action"] === undefined) {
      await route.continue();
      return;
    }
    intercepted = true;
    await new Promise((resolve) => setTimeout(resolve, 600));
    const committed = await route.fetch();
    expect(committed.status(), "controlled action must commit before its response is hidden").toBe(200);
    await route.fulfill({
      status: 503,
      contentType: "text/plain; charset=utf-8",
      body: "controlled transport failure",
    });
  };
  await page.route(pattern, handler);
  return {
    async wait() {
      await expect.poll(() => intercepted).toBe(true);
    },
    async dispose() {
      await page.unroute(pattern, handler);
    },
  };
}

const test = base.extend({
  todoApp: async ({}, use, testInfo) => {
    await fs.access(path.join(EXAMPLE, ".next/BUILD_ID"));
    parseState(SMOKE_STATE);
    const runId = `e2e-${process.pid}-${testInfo.workerIndex}-${randomUUID()}`;
    const runRoot = path.join(CONTROL, "runs", runId);
    const statePath = path.join(runRoot, "todoapp-state.tsv");
    await fs.mkdir(runRoot, { recursive: true, mode: 0o700 });
    await fs.writeFile(statePath, SMOKE_STATE, { encoding: "utf8", mode: 0o600 });
    await fs.chmod(statePath, 0o600);
    expect((await fs.stat(runRoot)).mode & 0o777).toBe(0o700);
    expect((await fs.stat(statePath)).mode & 0o777).toBe(0o600);

    const links = await linkWorkspaceDependencies();
    const port = await reservePort();
    const baseURL = `http://127.0.0.1:${port}`;
    const child = spawn(
      process.execPath,
      [NEXT_BIN, "start", ".", "-H", "127.0.0.1", "-p", String(port)],
      {
        cwd: EXAMPLE,
        env: {
          ...process.env,
          CI: "1",
          NEXT_TELEMETRY_DISABLED: "1",
          NEXTJSHX_TODO_DETAIL_DELAY_MS: "750",
          NEXTJSHX_TODO_RUN_ID: runId,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    for (const stream of [child.stdout, child.stderr]) {
      stream.on("data", (chunk) => {
        output += chunk;
      });
    }
    const exitPromise = new Promise((resolve) => child.once("exit", resolve));

    try {
      await waitForServer(baseURL);
      await use({ baseURL, statePath, initialState: SMOKE_STATE });
      if (child.exitCode !== null || child.signalCode !== null) {
        throw new Error(`Next production server exited unexpectedly:\n${output}`);
      }
    } finally {
      await stopServer(child, exitPromise);
      await fs.rm(runRoot, { recursive: true, force: true });
      await removeFixtureLinks(links);
    }
  },
  diagnostics: async ({ page }, use) => {
    const diagnostics = observeDiagnostics(page);
    await use(diagnostics);
    diagnostics.verify();
  },
});

test("streams loading UI, navigates typed links, and renders the Haxe not-found view", async ({
  page,
  todoApp,
  diagnostics,
}) => {
  const response = await page.goto(todoApp.baseURL, { waitUntil: "networkidle" });
  expect(response?.status()).toBe(200);
  await expect(page.locator("#todo-list-page:visible")).toBeVisible();
  await expect(page.locator("#todo-list-page:visible .todo-row")).toHaveCount(3);
  diagnostics.allowAbortedRsc("/todos/shape-first-release");
  diagnostics.allowAbortedRsc("/");

  await page
    .locator("#todo-list-page:visible .todo-row")
    .filter({ hasText: "Runtime state won the read" })
    .locator(".todo-link")
    .click();
  await expect(page.locator("#todo-loading:visible")).toBeVisible();
  await expect(page.locator("#todo-detail-page:visible")).toBeVisible();
  await expect(page).toHaveURL(`${todoApp.baseURL}/todos/shape-first-release`);
  await expect(page.locator("#todo-detail-page:visible h2")).toHaveText("Runtime state won the read");
  await page.waitForLoadState("networkidle");
  await page.locator(".back-link:visible").click();
  await expect(page.locator("#todo-list-page:visible")).toBeVisible();
  await expect(page).toHaveURL(`${todoApp.baseURL}/`);
  await page.waitForLoadState("networkidle");

  diagnostics.allowResponse(404, "/todos/not-seeded");
  const missing = await page.goto(`${todoApp.baseURL}/todos/not-seeded`, { waitUntil: "networkidle" });
  expect(missing?.status()).toBe(200);
  await expect(page.locator("#todo-not-found")).toBeVisible();
  await expect(page.locator("#todo-not-found h2")).toHaveText("No note lives here.");
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", "noindex");
});

test("reorders field notes with the pointer on the desktop layout", async ({
  page,
  todoApp,
}) => {
  await page.goto(todoApp.baseURL, { waitUntil: "networkidle" });
  await expect(page.locator("#todo-list-page:visible .todo-row")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Reorder Runtime state won the read" })).toHaveAttribute(
    "aria-roledescription",
    "draggable",
  );
  await pointerReorder(page, "Runtime state won the read", "Write the adoption guide");
  await expect
    .poll(() => todoOrder(page))
    .toEqual([
      "Prove the production build",
      "Write the adoption guide",
      "Runtime state won the read",
    ]);
  await expect(page.locator("#reorder-status")).toHaveText(
    "Ledger order committed.",
  );
});

test("reorders through the package keyboard sensor and announces the result", async ({
  page,
  todoApp,
}) => {
  await page.goto(todoApp.baseURL, { waitUntil: "networkidle" });
  const handle = page.getByRole("button", { name: "Reorder Runtime state won the read" });
  await handle.focus();
  await expect(handle).toBeFocused();
  await handle.press("Space");
  await expect(handle).toHaveAttribute("aria-pressed", "true");
  await handle.press("ArrowDown");
  await handle.press("Space");
  await expect
    .poll(() => todoOrder(page))
    .toEqual([
      "Prove the production build",
      "Runtime state won the read",
      "Write the adoption guide",
    ]);
  await expect(page.locator("#reorder-status")).toHaveText(
    "Ledger order committed.",
  );
});

test("keeps pointer sorting usable in the narrow mobile layout", async ({ page, todoApp }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(todoApp.baseURL, { waitUntil: "networkidle" });
  const handle = page.getByRole("button", { name: "Reorder Write the adoption guide" });
  await expect(handle).toBeVisible();
  await expect(handle).toHaveCSS("touch-action", "none");
  await pointerReorder(page, "Write the adoption guide", "Runtime state won the read");
  await expect
    .poll(() => todoOrder(page))
    .toEqual([
      "Write the adoption guide",
      "Runtime state won the read",
      "Prove the production build",
    ]);
  await expect(page.locator("#reorder-status")).toHaveText(
    "Ledger order committed.",
  );
});

test("renders real status lanes and keeps board reordering inside its lane", async ({
  page,
  todoApp,
}) => {
  await page.goto(`${todoApp.baseURL}/?view=board`, { waitUntil: "networkidle" });

  const board = page.getByRole("group", { name: "Todo status board" });
  const openLane = page.locator('[data-board-lane="open"]');
  const completedLane = page.locator('[data-board-lane="completed"]');
  await expect(board).toBeVisible();
  await expect(openLane.getByRole("heading", { name: "Open work" })).toBeVisible();
  await expect(completedLane.getByRole("heading", { name: "Complete" })).toBeVisible();
  await expect(openLane.locator(".board-lane-count strong")).toHaveText("2");
  await expect(completedLane.locator(".board-lane-count strong")).toHaveText("1");
  await expect(openLane.locator(".todo-link")).toHaveText([
    "Runtime state won the read",
    "Write the adoption guide",
  ]);
  await expect(completedLane.locator(".todo-link")).toHaveText([
    "Prove the production build",
  ]);

  const handle = openLane.getByRole("button", {
    name: "Reorder Runtime state won the read",
  });
  await handle.focus();
  await handle.press("Space");
  await expect(handle).toHaveAttribute("aria-pressed", "true");
  await handle.press("ArrowDown");
  await handle.press("Space");

  await expect.poll(() => openLane.locator(".todo-link").allTextContents()).toEqual([
    "Write the adoption guide",
    "Runtime state won the read",
  ]);
  await expect(completedLane.locator(".todo-link")).toHaveText([
    "Prove the production build",
  ]);
  await expect(page.locator("#reorder-status")).toHaveText(
    "Ledger order committed.",
  );
});

test("renders useful List and Board states when the persisted ledger is empty", async ({
  page,
  todoApp,
}) => {
  await page.goto(todoApp.baseURL, { waitUntil: "networkidle" });

  for (const title of [
    "Runtime state won the read",
    "Prove the production build",
    "Write the adoption guide",
  ]) {
    const row = page.locator("#todo-list-page:visible .todo-row").filter({ hasText: title });
    await row.getByRole("button", { name: `Delete ${title}` }).click();
    await expect(row).toHaveCount(0);
  }

  const emptyLedger = page.locator(".empty-ledger");
  await expect(page.locator("#todo-list-page:visible .todo-row")).toHaveCount(0);
  await expect(emptyLedger).toHaveAttribute("role", "status");
  await expect(emptyLedger.getByRole("heading", { name: "The field desk is clear." })).toBeVisible();
  await expect(emptyLedger).toContainText("File the first piece of work above");
  await expect(page.locator("#todo-count")).toHaveText("0 shown / 0 open / 0 total");
  await expect(page.locator("[data-planning-open]")).toHaveText("0");
  await expect(page.locator("[data-planning-completed]")).toHaveText("0");
  await expect(page.locator("[data-planning-percent]")).toHaveText("0%");
  await expect(page.locator(".planning-table tbody tr")).toHaveCount(3);
  expect(await fs.readFile(todoApp.statePath, "utf8")).toBe(
    "id\tcompleted\tpriority\ttitle\tnote\n",
  );

  await page.getByRole("button", { name: "Board", exact: true }).click();
  await expect(page.locator('[data-board-lane="open"]')).toContainText(
    "No open notes in this lens.",
  );
  await expect(page.locator('[data-board-lane="completed"]')).toContainText(
    "Nothing is filed in this lens.",
  );
});

test("keeps the URL-owned discovery lens replayable and resets every dimension", async ({
  page,
  todoApp,
}) => {
  await page.goto(todoApp.baseURL, { waitUntil: "networkidle" });
  const rows = page.locator("#todo-list-page:visible .todo-row");
  const count = page.locator("#todo-count");
  const search = page.getByLabel("Search title or note");
  const reset = page.getByRole("button", { name: "Reset lens" });

  await expect(count).toHaveText("3 shown / 2 open / 3 total");
  await expect(page.getByRole("group", { name: "Status" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Priority" })).toBeVisible();
  await expect(page.getByRole("group", { name: "View" })).toBeVisible();
  await expect(reset).toBeDisabled();

  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("status")).toBe("open");
  await expect(rows).toHaveCount(2);
  await expect(count).toHaveText("2 shown / 2 open / 3 total");

  await page.getByRole("button", { name: "P0", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("priority")).toBe("P0");
  await expect(rows).toHaveCount(1);

  await search.fill("adoption");
  await expect.poll(() => new URL(page.url()).searchParams.get("search")).toBe("adoption");
  await expect(rows).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "No notes match these coordinates." })).toBeVisible();
  await expect(reset).toBeEnabled();

  await page.getByRole("button", { name: "Board", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("view")).toBe("board");
  await expect(page.locator(".workbench")).toHaveAttribute("data-view", "board");

  await page.goBack({ waitUntil: "networkidle" });
  await expect.poll(() => new URL(page.url()).searchParams.get("view")).toBeNull();
  await expect.poll(() => new URL(page.url()).searchParams.get("priority")).toBe("P0");
  await expect(search).toHaveValue("adoption");

  await page.goBack({ waitUntil: "networkidle" });
  await expect.poll(() => new URL(page.url()).searchParams.get("status")).toBe("open");
  await expect.poll(() => new URL(page.url()).searchParams.get("priority")).toBeNull();
  await expect.poll(() => new URL(page.url()).searchParams.get("search")).toBeNull();
  await expect(rows).toHaveCount(2);

  await page.goForward({ waitUntil: "networkidle" });
  await expect.poll(() => new URL(page.url()).searchParams.get("priority")).toBe("P0");
  await expect(search).toHaveValue("adoption");
  await page.goForward({ waitUntil: "networkidle" });
  await expect(page.locator(".workbench")).toHaveAttribute("data-view", "board");

  await reset.click();
  await expect.poll(() => new URL(page.url()).search).toBe("");
  await expect(page.locator(".workbench")).toHaveAttribute("data-view", "list");
  await expect(search).toHaveValue("");
  await expect(rows).toHaveCount(3);
  await expect(reset).toBeDisabled();

  await page.getByRole("button", { name: "Board", exact: true }).click();
  await expect(reset).toBeEnabled();
  await reset.click();
  await expect.poll(() => new URL(page.url()).searchParams.get("view")).toBeNull();
  await expect(page.locator(".workbench")).toHaveAttribute("data-view", "list");
});

test("keeps the typed priority runway, summary, and accessible table in agreement", async ({
  page,
  todoApp,
}) => {
  await page.goto(todoApp.baseURL, { waitUntil: "networkidle" });

  const insight = page.getByRole("region", { name: "See where the work is sitting." });
  const table = insight.getByRole("table");
  const rows = table.locator("tbody tr");
  await expect(insight).toHaveAttribute("data-planning-scope", "all");
  await expect(table).toHaveAccessibleName(
    "Planning values for all work; the same values are drawn in the chart.",
  );
  await expect(insight.locator("[data-planning-open]")).toHaveText("2");
  await expect(insight.locator("[data-planning-completed]")).toHaveText("1");
  await expect(insight.locator("[data-planning-percent]")).toHaveText("33%");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0).locator("th, td")).toHaveText(["P0", "1", "0", "1"]);
  await expect(rows.nth(1).locator("th, td")).toHaveText(["P1", "0", "1", "1"]);
  await expect(rows.nth(2).locator("th, td")).toHaveText(["P2", "1", "0", "1"]);

  const chart = insight.locator(".planning-chart");
  await expect(chart).toBeVisible();
  await expect(insight.locator("svg desc")).toHaveText(
    "Open and completed field notes grouped by P0, P1, and P2 priority.",
  );
  const focusableChart = insight.locator('[tabindex="0"]').first();
  await expect(focusableChart).toBeVisible();
  await focusableChart.focus();
  await expect(focusableChart).toBeFocused();

  await page.getByRole("button", { name: "P0", exact: true }).click();
  await expect(insight).toHaveAttribute("data-planning-scope", "filtered");
  await expect(table).toHaveAccessibleName(
    "Planning values for current lens; the same values are drawn in the chart.",
  );
  await expect(insight.locator("[data-planning-open]")).toHaveText("1");
  await expect(insight.locator("[data-planning-completed]")).toHaveText("0");
  await expect(insight.locator("[data-planning-percent]")).toHaveText("0%");
  await expect(rows.nth(0).locator("th, td")).toHaveText(["P0", "1", "0", "1"]);
  await expect(rows.nth(1).locator("th, td")).toHaveText(["P1", "0", "0", "0"]);
  await expect(rows.nth(2).locator("th, td")).toHaveText(["P2", "0", "0", "0"]);

  await page.getByRole("button", { name: "Reset lens" }).click();
  await expect.poll(() => new URL(page.url()).search).toBe("");
  await page.getByLabel("Search title or note").fill("Prove the production");
  await expect.poll(() => new URL(page.url()).searchParams.get("search")).toBe("Prove the production");
  await expect(insight.locator("[data-planning-open]")).toHaveText("0");
  await expect(insight.locator("[data-planning-completed]")).toHaveText("1");
  await expect(insight.locator("[data-planning-percent]")).toHaveText("100%");
  await expect(rows.nth(1).locator("th, td")).toHaveText(["P1", "0", "1", "1"]);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(insight).toBeVisible();
  await expect(table).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
    "planning insight must not create horizontal page overflow",
  ).toBe(true);
});

test("restores shared discovery links and closes invalid domains on mobile and keyboard", async ({
  page,
  todoApp,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    `${todoApp.baseURL}/?status=done&priority=P1&view=board&search=production`,
    { waitUntil: "networkidle" },
  );

  await expect(page.getByRole("button", { name: "Complete", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "P1", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Board", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByLabel("Search title or note")).toHaveValue("production");
  await expect(page.locator(".workbench")).toHaveAttribute("data-view", "board");
  await expect(page.locator("#todo-list-page:visible .todo-row")).toHaveCount(1);
  await expect(page.locator("#todo-count")).toHaveText("1 shown / 2 open / 3 total");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);

  await page.goto(
    `${todoApp.baseURL}/?status=not-a-status&priority=P9&view=grid&search=missing`,
    { waitUntil: "networkidle" },
  );
  await expect(page.getByRole("button", { name: "All work", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "All levels", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "List", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("heading", { name: "No notes match these coordinates." })).toBeVisible();

  const complete = page.getByRole("button", { name: "Complete", exact: true });
  await complete.focus();
  await expect(complete).toBeFocused();
  await complete.press("Enter");
  await expect.poll(() => new URL(page.url()).searchParams.get("status")).toBe("done");
  await expect(complete).toHaveAttribute("aria-pressed", "true");
});

test("keeps the typed command desk discoverable, keyboard complete, and viewport contained", async ({
  page,
  todoApp,
  diagnostics,
}) => {
  await page.goto(todoApp.baseURL, { waitUntil: "networkidle" });
  const trigger = page.getByRole("button", { name: "Open command desk" });
  const dialog = page.getByRole("dialog", { name: "Field Ledger command desk" });
  const commandInput = page.getByRole("combobox", { name: "Field Ledger command desk" });

  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
  await trigger.click();
  await expect(dialog).toBeVisible();
  await expect(commandInput).toBeFocused();
  await expect(page.getByRole("listbox", { name: "Available Field Ledger commands" })).toBeVisible();

  await commandInput.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  await page.keyboard.press("ControlOrMeta+K");
  await expect(dialog).toBeVisible();
  await commandInput.fill("board");
  await expect(page.getByRole("option", { name: /Use the status board/ })).toBeVisible();
  await commandInput.press("Enter");
  await expect(dialog).toBeHidden();
  await expect.poll(() => new URL(page.url()).searchParams.get("view")).toBe("board");
  await expect(page.locator(".workbench")).toHaveAttribute("data-view", "board");
  await expect(trigger).toBeFocused();

  await page.keyboard.press("ControlOrMeta+K");
  await commandInput.fill("file a new field note");
  await expect(page.getByRole("option", { name: /File a new field note/ })).toBeVisible();
  await commandInput.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(page.locator("#todo-title")).toBeFocused();

  await page.keyboard.press("ControlOrMeta+K");
  await commandInput.fill("runtime state won");
  await expect(page.getByRole("option", { name: /Open “Runtime state won the read”/ })).toBeVisible();
  diagnostics.allowAbortedRsc("/");
  diagnostics.allowAbortedRsc("/todos/shape-first-release");
  await commandInput.press("Enter");
  await expect(page).toHaveURL(`${todoApp.baseURL}/todos/shape-first-release`);
  await expect(page.locator("#todo-detail-page:visible h2")).toHaveText("Runtime state won the read");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(todoApp.baseURL, { waitUntil: "networkidle" });
  const mobileTrigger = page.getByRole("button", { name: "Open command desk" });
  await mobileTrigger.click();
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(box.y + box.height).toBeLessThanOrEqual(844);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await commandInput.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(mobileTrigger).toBeFocused();
});

test("fails malformed API input closed and makes cache invalidation visible", async ({
  page,
  todoApp,
}) => {
  await page.goto(todoApp.baseURL, { waitUntil: "networkidle" });
  const rows = page.locator("#todo-list-page:visible .todo-row");
  await expect(rows).toHaveCount(3);
  const headers = {
    accept: "application/json",
    "x-field-ledger-client": "playwright-e2e",
    cookie: "field-ledger-visitor=bead-r06",
  };

  const listed = await page.request.get(`${todoApp.baseURL}/api/todos`, { headers });
  expect(listed.status()).toBe(200);
  expect(await listed.json()).toMatchObject({
    ok: true,
    request: { source: "playwright-e2e", visitor: "bead-r06" },
  });

  const beforeMalformed = await fs.readFile(todoApp.statePath, "utf8");
  const malformed = await page.request.post(`${todoApp.baseURL}/api/todos`, {
    headers: { ...headers, "content-type": "application/json" },
    data: Buffer.from("{not-json", "utf8"),
  });
  expect(malformed.status()).toBe(400);
  expect(await malformed.json()).toEqual({
    ok: false,
    todo: null,
    issues: [
      {
        code: "invalid_json",
        path: "$",
        message: "request body must contain valid JSON",
      },
    ],
    request: { source: "playwright-e2e", visitor: "bead-r06" },
  });
  expect(await fs.readFile(todoApp.statePath, "utf8")).toBe(beforeMalformed);
  await expect(rows).toHaveCount(3);

  const title = "Invalidate the isolated E2E cache";
  const created = await page.request.post(`${todoApp.baseURL}/api/todos`, {
    headers: { ...headers, "content-type": "application/json" },
    data: JSON.stringify({
      title,
      note: "Prove the per-run cache tag expires before the next production render.",
      priority: "P1",
    }),
  });
  expect(created.status()).toBe(201);
  expect(await created.json()).toMatchObject({
    ok: true,
    todo: { id: "invalidate-the-isolated-e2e-cache", title, priority: "P1" },
  });
  await expect(rows).toHaveCount(3);
  await page.reload({ waitUntil: "networkidle" });
  const createdRow = page.locator("#todo-list-page:visible .todo-row").filter({ hasText: title });
  await expect(createdRow).toBeVisible();
  await expect(page.locator("#todo-list-page:visible .todo-row")).toHaveCount(4);
  await createdRow.getByRole("button", { name: `Delete ${title}` }).click();
  await expect(createdRow).toHaveCount(0);
  await expect(page.locator("#todo-list-page:visible .todo-row")).toHaveCount(3);
  expect(await fs.readFile(todoApp.statePath, "utf8")).toBe(todoApp.initialState);
});

test("validates and executes create, detail, toggle, and delete Server Actions", async ({
  page,
  todoApp,
}) => {
  await page.goto(todoApp.baseURL, { waitUntil: "networkidle" });
  const rows = page.locator("#todo-list-page:visible .todo-row");

  await page.locator("#todo-title").fill("   ");
  await page.locator("#todo-note").fill("This should remain outside the ledger.");
  await page.locator("#create-todo-form button[type=submit]").click();
  await expect(page.locator('#create-todo-issues li[data-path="form.title"]')).toBeVisible();
  await expect(rows).toHaveCount(3);
  expect(await fs.readFile(todoApp.statePath, "utf8")).toBe(todoApp.initialState);

  const malformedRow = page
    .locator("#todo-list-page:visible .todo-row")
    .filter({ hasText: "Runtime state won the read" });
  const completeButton = malformedRow.getByRole("button", {
    name: "Complete Runtime state won the read",
  });
  const hiddenId = completeButton.locator("xpath=ancestor::form[1]").locator('input[name="id"]');
  await hiddenId.evaluate((input) => {
    input.value = "INVALID ID";
  });
  await completeButton.click();
  await expect(malformedRow.locator('[data-phase="rejected"]')).toContainText(
    "The status request was rejected",
  );
  expect(await fs.readFile(todoApp.statePath, "utf8")).toBe(todoApp.initialState);
  await hiddenId.evaluate((input) => {
    input.value = "shape-first-release";
  });

  const title = "Exercise typed Playwright mutations";
  const id = "exercise-typed-playwright-mutations";
  await page.locator("#todo-title").fill(title);
  await page
    .locator("#todo-note")
    .fill("Prove create, refresh, dynamic detail, toggle, and delete through native action boundaries.");
  await page.locator("#todo-priority").selectOption("P1");
  await page.locator("#create-todo-form button[type=submit]").click();
  let createdRow = page.locator("#todo-list-page:visible .todo-row").filter({ hasText: title });
  await expect(createdRow).toBeVisible();
  await expect(rows).toHaveCount(4);
  let state = parseState(await fs.readFile(todoApp.statePath, "utf8"));
  expect(state.find((record) => record.id === id)).toMatchObject({ priority: "P1", completed: false });

  await createdRow.locator(".todo-link").click();
  await expect(page.locator("#todo-detail-page:visible")).toBeVisible();
  await expect(page).toHaveURL(`${todoApp.baseURL}/todos/${id}`);
  await expect(page.locator("#todo-detail-page:visible h2")).toHaveText(title);
  await page.locator(".back-link:visible").click();
  await expect(page.locator("#todo-list-page:visible")).toBeVisible();

  const firstRow = page
    .locator("#todo-list-page:visible .todo-row")
    .filter({ hasText: "Runtime state won the read" });
  await firstRow.getByRole("button", { name: "Complete Runtime state won the read" }).click();
  await expect(firstRow).toHaveClass(/is-done/);
  state = parseState(await fs.readFile(todoApp.statePath, "utf8"));
  expect(state.find((record) => record.id === "shape-first-release")?.completed).toBe(true);

  createdRow = page.locator("#todo-list-page:visible .todo-row").filter({ hasText: title });
  await createdRow.getByRole("button", { name: `Delete ${title}` }).click();
  await expect(createdRow).toHaveCount(0);
  state = parseState(await fs.readFile(todoApp.statePath, "utf8"));
  expect(state.some((record) => record.id === id)).toBe(false);
});

test("rolls optimistic mutations back, survives offline state, and retries each committed action once", async ({
  page,
  todoApp,
  diagnostics,
}) => {
  await page.goto(todoApp.baseURL, { waitUntil: "networkidle" });
  const title = "Recover one ambiguous field note";
  const id = "recover-one-ambiguous-field-note";

  await page.locator("#todo-title").fill(title);
  await page.locator("#todo-note").fill("Prove rollback, reconnect, replay identity, and one final committed record.");
  await page.locator("#todo-priority").selectOption("P1");
  let failure = await failNextServerActionAfterCommit(page, diagnostics);
  const createButton = page.locator("#create-todo-form button[type=submit]");
  await createButton.click();
  await expect(createButton).toBeDisabled();
  await expect(page.locator(".optimistic-draft")).toBeVisible();
  await expect(page.locator("#create-todo-status")).toContainText("Filing an optimistic field note");
  await failure.wait();
  await expect(page.locator('#create-todo-status[data-phase="transport-failure"]')).toBeVisible();
  await expect(page.locator(".optimistic-draft")).toBeHidden();
  await expect(createButton).toBeDisabled();
  await failure.dispose();

  let state = parseState(await fs.readFile(todoApp.statePath, "utf8"));
  expect(state.filter((record) => record.id === id)).toHaveLength(1);
  await expect(page.locator("#todo-list-page:visible .todo-row")).toHaveCount(3);

  await page.context().setOffline(true);
  await expect(page.locator("#create-todo-status")).toContainText("Offline");
  await expect(page.getByRole("button", { name: "Retry safely" }).first()).toBeDisabled();
  await page.context().setOffline(false);
  await expect(page.getByRole("button", { name: "Retry safely" }).first()).toBeEnabled();
  await page.getByRole("button", { name: "Retry safely" }).first().click();
  let createdRow = page.locator("#todo-list-page:visible .todo-row").filter({ hasText: title });
  await expect(createdRow).toBeVisible();
  state = parseState(await fs.readFile(todoApp.statePath, "utf8"));
  expect(state.filter((record) => record.id === id)).toHaveLength(1);

  const toggledRow = page
    .locator("#todo-list-page:visible .todo-row")
    .filter({ hasText: "Runtime state won the read" });
  failure = await failNextServerActionAfterCommit(page, diagnostics);
  await toggledRow.getByRole("button", { name: "Complete Runtime state won the read" }).click();
  await expect(toggledRow.locator(".row-actions")).toHaveAttribute("data-optimistic-completed", "true");
  await failure.wait();
  await expect(toggledRow.locator('[data-phase="transport-failure"]')).toBeVisible();
  await expect(toggledRow.locator(".row-actions")).toHaveAttribute("data-optimistic-completed", "false");
  await failure.dispose();
  state = parseState(await fs.readFile(todoApp.statePath, "utf8"));
  expect(state.find((record) => record.id === "shape-first-release")?.completed).toBe(true);
  await toggledRow.getByRole("button", { name: "Retry safely" }).click();
  await expect(toggledRow).toHaveClass(/is-done/);

  createdRow = page.locator("#todo-list-page:visible .todo-row").filter({ hasText: title });
  failure = await failNextServerActionAfterCommit(page, diagnostics);
  await createdRow.getByRole("button", { name: `Delete ${title}` }).click();
  await expect(createdRow.locator(".row-actions")).toHaveAttribute("data-optimistic-visible", "false");
  await failure.wait();
  await expect(createdRow.locator('[data-phase="transport-failure"]')).toBeVisible();
  await expect(createdRow.locator(".row-actions")).toHaveAttribute("data-optimistic-visible", "true");
  await failure.dispose();
  state = parseState(await fs.readFile(todoApp.statePath, "utf8"));
  expect(state.some((record) => record.id === id)).toBe(false);
  await createdRow.getByRole("button", { name: "Retry safely" }).click();
  await expect(createdRow).toHaveCount(0);

  const originalOrder = await todoOrder(page);
  failure = await failNextServerActionAfterCommit(page, diagnostics);
  await pointerReorder(page, "Runtime state won the read", "Write the adoption guide");
  await expect.poll(() => todoOrder(page)).toEqual([
    "Prove the production build",
    "Write the adoption guide",
    "Runtime state won the read",
  ]);
  await failure.wait();
  await expect(page.locator('#reorder-status[data-phase="transport-failure"]')).toBeVisible();
  await expect.poll(() => todoOrder(page)).toEqual(originalOrder);
  await failure.dispose();
  await page.getByRole("button", { name: "Retry saved order" }).click();
  await expect.poll(() => todoOrder(page)).toEqual([
    "Prove the production build",
    "Write the adoption guide",
    "Runtime state won the read",
  ]);

  state = parseState(await fs.readFile(todoApp.statePath, "utf8"));
  expect(state.map((record) => record.title)).toEqual([
    "Prove the production build",
    "Write the adoption guide",
    "Runtime state won the read",
  ]);
  const receipts = await fs.readFile(
    path.join(path.dirname(todoApp.statePath), "todoapp-mutations.tsv"),
    "utf8",
  );
  const receiptRows = receipts.trimEnd().split("\n");
  expect(receiptRows[0]).toBe("operation\tmutation_id");
  expect(receiptRows.slice(1)).toHaveLength(4);
  expect(new Set(receiptRows.slice(1)).size).toBe(4);
});

test("contains a deliberate client failure and recovers through the typed Haxe reset", async ({
  page,
  todoApp,
  diagnostics,
}) => {
  diagnostics.allowError(RECOVERABLE_ERROR);
  await page.goto(`${todoApp.baseURL}/todos/shape-first-release`, { waitUntil: "networkidle" });
  await expect(page.locator("#failure-proof-title")).toHaveText("Test this route's safety net.");
  await page.getByRole("button", { name: "Trigger recoverable fault" }).click();
  await expect(page.locator("#todo-error")).toBeVisible();
  await expect(page.locator("#todo-error-message")).toContainText(RECOVERABLE_ERROR);
  if (process.env.NEXTJSHX_TODO_SCREENSHOT === "1") {
    await fs.mkdir(CONTROL, { recursive: true, mode: 0o700 });
    await page.screenshot({ path: path.join(CONTROL, "todo-error-preview.png"), fullPage: true });
  }
  await page.waitForTimeout(550);
  await page.getByRole("button", { name: "Retry this field note" }).click();
  await expect(page.locator("#todo-detail-page:visible")).toBeVisible();
  await expect(page.locator("#todo-error")).toHaveCount(0);
  await expect(page.locator("#todo-detail-page:visible h2")).toHaveText("Runtime state won the read");
});
