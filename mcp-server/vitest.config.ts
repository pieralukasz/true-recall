import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		name: "mcp-server",
		root: resolve(import.meta.dirname),
		environment: "node",
		include: ["tests/**/*.test.ts"],
	},
});
