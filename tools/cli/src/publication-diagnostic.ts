export type PublicationDiagnosticCode =
  | "NXHX-TRANSACTION-LOCKED-0001"
  | "NXHX-TRANSACTION-JOURNAL-0002"
  | "NXHX-TRANSACTION-STATE-0003"
  | "NXHX-TRANSACTION-STAGING-0004"
  | "NXHX-TRANSACTION-FORMAT-0005"
  | "NXHX-TRANSACTION-SYNTAX-0006"
  | "NXHX-TRANSACTION-RECOVERY-0007"
  | "NXHX-TRANSACTION-VALIDATION-0008"
  | "NXHX-TRANSACTION-FILESYSTEM-0009";

export interface PublicationDiagnostic {
  readonly code: PublicationDiagnosticCode;
  readonly message: string;
  readonly target: string;
  readonly expected: string;
  readonly actual: string;
  readonly resolution: string;
  readonly docs: "docs/generated-output-publication.md";
}

export class PublicationDiagnosticError extends Error {
  readonly diagnostic: PublicationDiagnostic;

  constructor(diagnostic: Omit<PublicationDiagnostic, "docs">) {
    super(`${diagnostic.code}: ${diagnostic.message}`);
    this.name = "PublicationDiagnosticError";
    this.diagnostic = Object.freeze({
      ...diagnostic,
      docs: "docs/generated-output-publication.md" as const,
    });
  }

  toJSON(): PublicationDiagnostic {
    return this.diagnostic;
  }
}

export function publicationFailure(
  code: PublicationDiagnosticCode,
  message: string,
  target: string,
  expected: string,
  actual: string,
  resolution: string,
): never {
  throw new PublicationDiagnosticError({
    code,
    message,
    target,
    expected,
    actual,
    resolution,
  });
}
