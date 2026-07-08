import { describe, expect, it } from "vitest";
import { shouldToggleAskFromKeyboardEvent } from "../ask-shortcuts";

function keyEvent(key: string, options: Partial<KeyboardEvent> = {}) {
  return new KeyboardEvent("keydown", {
    key,
    ctrlKey: options.ctrlKey,
    metaKey: options.metaKey,
  });
}

describe("shouldToggleAskFromKeyboardEvent", () => {
  it("accepts Ctrl K, Meta K, and slash outside text entry", () => {
    const div = document.createElement("div");

    expect(shouldToggleAskFromKeyboardEvent(keyEvent("k", { ctrlKey: true }), div)).toBe(true);
    expect(shouldToggleAskFromKeyboardEvent(keyEvent("K", { metaKey: true }), div)).toBe(true);
    expect(shouldToggleAskFromKeyboardEvent(keyEvent("/"), div)).toBe(true);
  });

  it("ignores slash while a user is typing in editable controls", () => {
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    const editable = document.createElement("div");
    editable.contentEditable = "true";

    expect(shouldToggleAskFromKeyboardEvent(keyEvent("/"), input)).toBe(false);
    expect(shouldToggleAskFromKeyboardEvent(keyEvent("/"), textarea)).toBe(false);
    expect(shouldToggleAskFromKeyboardEvent(keyEvent("/"), editable)).toBe(false);
  });
});
