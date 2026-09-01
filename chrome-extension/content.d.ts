// Type surface for the test-only exports at the bottom of content.js.
// content.js is a Chrome content script (no ESM); tests import it via the
// guarded CommonJS export, and this declaration keeps `tsc --noEmit` honest.

export type Board = "greenhouse" | "lever" | "workday" | "indeed" | "linkedin" | "unknown";

export interface ExtractionResult {
  text: string;
  path: string;
  selector: string | null;
  length: number;
  board: Board;
}

declare const contentApi: {
  detectBoard(): Board;
  extractJobDescription(): ExtractionResult;
  BOARD_SELECTORS: Record<Board, string[]>;
  MIN_JD_CHARS: number;
  MAX_JD_CHARS: number;
};

export = contentApi;
