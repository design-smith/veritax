export type AskMode = "ask" | "goto" | "run" | "create";

export interface ModeResult {
  mode: AskMode;
  payload: string;
}

/** Infer the Ask mode from the raw input string. */
export function inferAskMode(input: string): AskMode;
export function inferAskMode(input: string, withPayload: true): ModeResult;
export function inferAskMode(input: string, withPayload?: true): AskMode | ModeResult {
  let mode: AskMode = "ask";
  let payload = input;

  if (input.startsWith(">")) {
    mode = "run";
    payload = input.replace(/^>\s*/, "");
  } else if (input.startsWith("@")) {
    mode = "goto";
    payload = input.replace(/^@\s*/, "");
  } else if (/^\/(create|new)\s/i.test(input)) {
    mode = "create";
    payload = input.replace(/^\/(create|new)\s*/i, "");
  }

  if (withPayload) return { mode, payload };
  return mode;
}
