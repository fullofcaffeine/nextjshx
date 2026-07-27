export type OwnershipDiagnosticCode =
  | "NXHX-OWNERSHIP-MANIFEST-0001"
  | "NXHX-OWNERSHIP-VERSION-0002"
  | "NXHX-OWNERSHIP-PATH-0003"
  | "NXHX-OWNERSHIP-RESERVED-0004"
  | "NXHX-OWNERSHIP-DUPLICATE-0005"
  | "NXHX-OWNERSHIP-SYMLINK-0006"
  | "NXHX-OWNERSHIP-ESCAPE-0007"
  | "NXHX-OWNERSHIP-UNOWNED-0008"
  | "NXHX-OWNERSHIP-MODIFIED-0009"
  | "NXHX-OWNERSHIP-MISSING-0010"
  | "NXHX-OWNERSHIP-GENERATION-0011"
  | "NXHX-OWNERSHIP-ROOT-0012"
  | "NXHX-OWNERSHIP-TARGET-0013"
  | "NXHX-OWNERSHIP-TRANSFER-0014";

export interface OwnershipDiagnostic {
  readonly code: OwnershipDiagnosticCode;
  readonly message: string;
  readonly target: string;
  readonly expected: string;
  readonly actual: string;
  readonly resolution: string;
  readonly source?: string;
  readonly docs: "docs/generated-output-ownership.md";
}

export class OwnershipDiagnosticError extends Error {
  readonly diagnostic: OwnershipDiagnostic;

  constructor(diagnostic: Omit<OwnershipDiagnostic, "docs">) {
    super(`${diagnostic.code}: ${diagnostic.message}`);
    this.name = "OwnershipDiagnosticError";
    this.diagnostic = Object.freeze({
      ...diagnostic,
      docs: "docs/generated-output-ownership.md" as const,
    });
  }

  toJSON(): OwnershipDiagnostic {
    return this.diagnostic;
  }
}

export function ownershipFailure(
  code: OwnershipDiagnosticCode,
  message: string,
  target: string,
  expected: string,
  actual: string,
  resolution: string,
  source?: string,
): never {
  throw new OwnershipDiagnosticError({
    code,
    message,
    target,
    expected,
    actual,
    resolution,
    ...(source === undefined ? {} : { source }),
  });
}
