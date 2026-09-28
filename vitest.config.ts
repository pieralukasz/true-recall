import { defineConfig } from "vitest/config";

// Per-package configs live in packages/*/vitest.config.ts
export default defineConfig({
	test: {
		projects: [
			"packages/core/vitest.config.ts",
			"packages/obsidian/vitest.config.ts",
			"mcp-server/vitest.config.ts",
		],
	},
});
