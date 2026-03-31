import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const src = resolve(__dirname, "src");
const obsidianSrc = resolve(__dirname, "../obsidian/src");
const mocks = resolve(__dirname, "tests/__mocks__");

export default defineConfig({
	resolve: {
		alias: [
			{ find: /^@true-recall\/core\/(.+)$/, replacement: `${src}/$1` },
			{ find: "@true-recall/core", replacement: src },
			{
				find: /^@true-recall\/obsidian\/(.+)$/,
				replacement: `${obsidianSrc}/$1`,
			},
			{ find: "@true-recall/obsidian", replacement: obsidianSrc },
			{
				find: "@sqlite.org/sqlite-wasm/sqlite3.wasm",
				replacement: `${mocks}/sqlite3.wasm.ts`,
			},
			{
				find: "@sqlite.org/sqlite-wasm",
				replacement: `${mocks}/sqlite-wasm.ts`,
			},
			{ find: "obsidian", replacement: `${mocks}/obsidian.ts` },
		],
	},
	test: {
		name: "@true-recall/core",
		root: resolve(__dirname),
		globals: true,
		environment: "node",
		include: ["tests/**/*.test.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html", "json"],
			include: ["src/**/*.ts"],
			exclude: ["**/*.d.ts"],
		},
	},
});
