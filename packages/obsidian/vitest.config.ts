import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const src = resolve(import.meta.dirname, "src");
const coreSrc = resolve(import.meta.dirname, "../core/src");
const pluginsSrc = resolve(import.meta.dirname, "../plugins/src");
const mocks = resolve(import.meta.dirname, "tests/__mocks__");

export default defineConfig({
	resolve: {
		alias: [
			{
				find: /^@true-recall\/obsidian\/(.+)$/,
				replacement: `${src}/$1`,
			},
			{ find: "@true-recall/obsidian", replacement: src },
			{ find: /^@true-recall\/core\/(.+)$/, replacement: `${coreSrc}/$1` },
			{ find: "@true-recall/core", replacement: coreSrc },
			{
				find: /^@true-recall\/plugins\/(.+)$/,
				replacement: `${pluginsSrc}/$1`,
			},
			{ find: "@true-recall/plugins", replacement: pluginsSrc },
			{ find: "obsidian", replacement: `${mocks}/obsidian.ts` },
		],
	},
	test: {
		name: "@true-recall/obsidian",
		root: resolve(import.meta.dirname),
		globals: true,
		environment: "node",
		setupFiles: ["./tests/setup.ts"],
		include: ["tests/**/*.test.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html", "json"],
			include: ["src/**/*.ts"],
			exclude: ["**/*.d.ts"],
		},
	},
});
