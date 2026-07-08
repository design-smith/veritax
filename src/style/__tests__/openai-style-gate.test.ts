import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SCAN_ROOTS = ["src/app", "src/components", "src/contexts", "src/config", "src/data"];
const ALLOWED_FILES = new Set([
  "src/components/icons.tsx",
]);

const FORBIDDEN_STYLE_PATTERNS = [
  /\b(?:bg|text|border|ring|from|to|via|fill|stroke|decoration)-(?:slate|zinc|neutral|stone|gray|amber|yellow|orange|red|rose|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|lime|black|white)(?:-\d{1,3}|\/|\b)/,
  /\bshadow-(?:lg|xl|2xl)\b/,
  /#[0-9A-Fa-f]{3,8}|hsl\(|rgba?\(|oklch\(/,
];

function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") return [];
      return listFiles(fullPath);
    }

    if (!/\.(ts|tsx|css)$/.test(entry.name) || /\.test\./.test(entry.name)) {
      return [];
    }

    return [fullPath];
  });
}

describe("OpenAI Apps SDK UI styling gate", () => {
  it("keeps app surfaces on semantic SDK tokens", () => {
    const offenders = SCAN_ROOTS.flatMap((scanRoot) => listFiles(path.join(ROOT, scanRoot)))
      .map((filePath) => path.relative(ROOT, filePath).replaceAll(path.sep, "/"))
      .filter((relativePath) => !ALLOWED_FILES.has(relativePath))
      .flatMap((relativePath) => {
        const contents = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
        return contents
          .split(/\r?\n/)
          .map((line, index) => ({ line, index }))
          .filter(({ line }) => FORBIDDEN_STYLE_PATTERNS.some((pattern) => pattern.test(line)))
          .map(({ line, index }) => `${relativePath}:${index + 1}: ${line.trim()}`);
      });

    expect(offenders).toEqual([]);
  });
});
