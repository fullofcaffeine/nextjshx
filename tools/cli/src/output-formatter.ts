import ts from "typescript";

import type { PlannedGeneratedOutput } from "./ownership-preflight.js";
import { publicationFailure } from "./publication-diagnostic.js";

export type GeneratedOutputFormatter = (
  output: PlannedGeneratedOutput,
) => string | Uint8Array | Promise<string | Uint8Array>;

const UTF8 = new TextDecoder("utf-8", { fatal: true });

function sourceText(content: string | Uint8Array, target: string): string {
  if (typeof content === "string") {
    return content;
  }
  if (!(content instanceof Uint8Array)) {
    publicationFailure(
      "NXHX-TRANSACTION-FORMAT-0005",
      "The formatter received unsupported source bytes.",
      target,
      "a UTF-8 string or Uint8Array",
      typeof content,
      "Render generated adapters as UTF-8 TypeScript before publication.",
    );
  }
  try {
    return UTF8.decode(content);
  } catch (error) {
    publicationFailure(
      "NXHX-TRANSACTION-FORMAT-0005",
      "A generated adapter is not valid UTF-8.",
      target,
      "well-formed UTF-8 TypeScript source",
      error instanceof Error ? error.message : "invalid UTF-8",
      "Fix the renderer output; publication never guesses a source encoding.",
    );
  }
}

function syntaxDiagnostics(source: string, fileName: string): readonly ts.Diagnostic[] {
  const result = ts.transpileModule(source, {
    fileName,
    reportDiagnostics: true,
    compilerOptions: {
      jsx: ts.JsxEmit.Preserve,
      module: ts.ModuleKind.ESNext,
      newLine: ts.NewLineKind.LineFeed,
      target: ts.ScriptTarget.ESNext,
    },
  });
  return (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
}

function assertSyntax(source: string, fileName: string): void {
  const diagnostics = syntaxDiagnostics(source, fileName);
  if (diagnostics.length === 0) {
    return;
  }
  const first = diagnostics[0] as ts.Diagnostic;
  const position =
    first.file === undefined || first.start === undefined
      ? "unknown location"
      : (() => {
          const point = first.file.getLineAndCharacterOfPosition(first.start as number);
          return `${point.line + 1}:${point.character + 1}`;
        })();
  publicationFailure(
    "NXHX-TRANSACTION-SYNTAX-0006",
    "A generated adapter is not syntactically valid TypeScript.",
    fileName,
    "zero TypeScript parser errors",
    `TS${first.code} at ${position}: ${ts.flattenDiagnosticMessageText(first.messageText, " ")}`,
    "Fix the Haxe renderer or formatter before retrying; live adapters were not touched.",
  );
}

function defaultFormatter(output: PlannedGeneratedOutput): string {
  const source = sourceText(output.content, output.path);
  assertSyntax(source, output.path);
  const sourceFile = ts.createSourceFile(
    output.path,
    source,
    ts.ScriptTarget.Latest,
    true,
    output.path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  return ts
    .createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: false })
    .printFile(sourceFile);
}

async function invokeFormatter(
  formatter: GeneratedOutputFormatter,
  output: PlannedGeneratedOutput,
): Promise<string> {
  let formatted: string | Uint8Array;
  try {
    formatted = await formatter(output);
  } catch (error) {
    publicationFailure(
      "NXHX-TRANSACTION-FORMAT-0005",
      "The generated-output formatter failed.",
      output.path,
      "a successful deterministic formatter result",
      error instanceof Error ? error.message : "unknown formatter error",
      "Fix the formatter configuration and retry; live adapters were not touched.",
    );
  }
  return sourceText(formatted, output.path);
}

export async function formatGeneratedOutput(
  output: PlannedGeneratedOutput,
  formatter: GeneratedOutputFormatter = defaultFormatter,
): Promise<PlannedGeneratedOutput> {
  assertSyntax(sourceText(output.content, output.path), output.path);
  const first = await invokeFormatter(formatter, output);
  assertSyntax(first, output.path);
  const second = await invokeFormatter(formatter, { ...output, content: first });
  assertSyntax(second, output.path);
  if (first !== second) {
    publicationFailure(
      "NXHX-TRANSACTION-FORMAT-0005",
      "The generated-output formatter is not idempotent.",
      output.path,
      "identical bytes on a second formatting pass",
      "the second pass changed the source",
      "Use a deterministic formatter configuration before publishing generated adapters.",
    );
  }
  return Object.freeze({ ...output, content: first });
}
