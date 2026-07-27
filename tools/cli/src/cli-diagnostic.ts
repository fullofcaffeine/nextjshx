export type CliDiagnosticCode =
  | "NXHX-CLI-USAGE-0001"
  | "NXHX-CLI-PROCESS-0002"
  | "NXHX-CLI-HAXE-0003"
  | "NXHX-CLI-PLAN-0004"
  | "NXHX-CLI-RENDER-0005"
  | "NXHX-CLI-TYPECHECK-0006"
  | "NXHX-CLI-ROUTE-0007"
  | "NXHX-CLI-DOCTOR-0008"
  | "NXHX-CLI-BUILD-0009"
  | "NXHX-CLI-DEV-0010"
  | "NXHX-CLI-CLEAN-0011"
  | "NXHX-CLI-BOUNDARY-0013"
  | "NXHX-CLI-INIT-0015";

export interface CliDiagnostic {
  readonly code: CliDiagnosticCode;
  readonly message: string;
  readonly subject: string;
  readonly expected: string;
  readonly actual: string;
  readonly resolution: string;
  readonly docs: "docs/cli.md";
}

export class CliDiagnosticError extends Error {
  readonly diagnostic: CliDiagnostic;

  constructor(diagnostic: Omit<CliDiagnostic, "docs">) {
    super(`${diagnostic.code}: ${diagnostic.message}`);
    this.name = "CliDiagnosticError";
    this.diagnostic = Object.freeze({
      ...diagnostic,
      docs: "docs/cli.md" as const,
    });
  }

  toJSON(): CliDiagnostic {
    return this.diagnostic;
  }
}

export function cliFailure(
  code: CliDiagnosticCode,
  message: string,
  subject: string,
  expected: string,
  actual: string,
  resolution: string,
): never {
  throw new CliDiagnosticError({
    code,
    message,
    subject,
    expected,
    actual,
    resolution,
  });
}
