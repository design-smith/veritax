export type DiffChangeType = "insert" | "delete" | "equal";

export interface DiffChange {
  type: DiffChangeType;
  text: string;
}

/**
 * Simple word-level diff between two texts.
 * Returns an array of DiffChange segments.
 */
export function computeDiff(previous: string, current: string): DiffChange[] {
  if (previous === current) return [];

  const prevWords = previous.split(/(\s+)/);
  const currWords = current.split(/(\s+)/);

  // Build LCS table
  const m = prevWords.length;
  const n = currWords.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (prevWords[i - 1] === currWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack
  const changes: DiffChange[] = [];
  let i = m, j = n;
  const rawChanges: DiffChange[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && prevWords[i - 1] === currWords[j - 1]) {
      rawChanges.unshift({ type: "equal", text: prevWords[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawChanges.unshift({ type: "insert", text: currWords[j - 1] });
      j--;
    } else {
      rawChanges.unshift({ type: "delete", text: prevWords[i - 1] });
      i--;
    }
  }

  // Merge consecutive same-type segments and filter out equalities
  return rawChanges.filter((c) => c.type !== "equal" && c.text.trim() !== "");
}
