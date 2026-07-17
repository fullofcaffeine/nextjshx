import { exportedLabel } from "../out/typescript/index.js";
import { ExternalEntry } from "../out/typescript/compiler_gaps/ExternalEntry.js";

export const typeScriptTranscript: string = `${exportedLabel()}:${ExternalEntry.label()}`;
