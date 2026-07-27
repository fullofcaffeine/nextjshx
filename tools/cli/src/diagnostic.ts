export type ConfigDiagnosticCode =
  | "NXHX-CONFIG-READ-0001"
  | "NXHX-CONFIG-JSON-0002"
  | "NXHX-CONFIG-SHAPE-0003"
  | "NXHX-CONFIG-UNKNOWN-0004"
  | "NXHX-CONFIG-REQUIRED-0005"
  | "NXHX-CONFIG-VERSION-0006"
  | "NXHX-CONFIG-VALUE-0007"
  | "NXHX-CONFIG-PATH-0008"
  | "NXHX-CONFIG-PACKAGE-0009"
  | "NXHX-CONFIG-PROJECT-0010"
  | "NXHX-CONFIG-WORKSPACE-0011"
  | "NXHX-CONFIG-PACKAGE-MANAGER-0012"
  | "NXHX-CONFIG-APP-ROOT-0013"
  | "NXHX-CONFIG-NEXT-PACKAGE-0014"
  | "NXHX-CONFIG-SYMLINK-0015";

export interface ConfigDiagnostic {
  readonly code: ConfigDiagnosticCode;
  readonly message: string;
  readonly subject: string;
  readonly expected: string;
  readonly resolution: string;
  readonly docs: "docs/configuration.md";
}

export class ConfigDiagnosticError extends Error {
  readonly diagnostic: ConfigDiagnostic;

  constructor(diagnostic: Omit<ConfigDiagnostic, "docs">) {
    super(`${diagnostic.code}: ${diagnostic.message}`);
    this.name = "ConfigDiagnosticError";
    this.diagnostic = Object.freeze({
      ...diagnostic,
      docs: "docs/configuration.md" as const,
    });
  }

  toJSON(): ConfigDiagnostic {
    return this.diagnostic;
  }
}

export function configFailure(
  code: ConfigDiagnosticCode,
  message: string,
  subject: string,
  expected: string,
  resolution: string,
): never {
  throw new ConfigDiagnosticError({ code, message, subject, expected, resolution });
}
