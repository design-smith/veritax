import { describe, it, expect } from "vitest";
import { inferAskMode, type AskMode } from "../ask-mode";

describe("inferAskMode", () => {
  it("returns 'ask' for normal question text", () => {
    expect(inferAskMode("What is the UK royalty rate?")).toBe("ask");
  });

  it("returns 'run' when text starts with >", () => {
    expect(inferAskMode("> ic-scan")).toBe("run");
    expect(inferAskMode(">re-run")).toBe("run");
  });

  it("returns 'goto' when text starts with @", () => {
    expect(inferAskMode("@Veritax UK")).toBe("goto");
    expect(inferAskMode("@ finding fn1")).toBe("goto");
  });

  it("returns 'ask' for empty input", () => {
    expect(inferAskMode("")).toBe("ask");
  });

  it("returns 'create' when text starts with /create or /new", () => {
    expect(inferAskMode("/create data request")).toBe("create");
    expect(inferAskMode("/new commitment")).toBe("create");
  });

  it("strips the prefix to expose the payload", () => {
    const { mode, payload } = inferAskMode("> ic-scan all flows", true);
    expect(mode).toBe("run");
    expect(payload).toBe("ic-scan all flows");
  });

  it("returns payload equal to input for ask mode", () => {
    const { mode, payload } = inferAskMode("What is the arm's length range?", true);
    expect(mode).toBe("ask");
    expect(payload).toBe("What is the arm's length range?");
  });
});
