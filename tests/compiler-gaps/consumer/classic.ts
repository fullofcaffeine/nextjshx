import { exportedLabel } from "../out/classic/index.js";
import { ExternalEntry } from "../out/classic/compiler_gaps/ExternalEntry.js";

export const classicTranscript: string = `${exportedLabel()}:${ExternalEntry.label()}`;
