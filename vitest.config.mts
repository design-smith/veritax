import { defineConfig } from "vitest/config"

// Scoped to the frontend analytics unit tests (the backend uses pytest). Pure TS, node environment.
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
})
