import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const src = resolve(__dirname, "src");
const coreSrc = resolve(__dirname, "../core/src");
const mocks = resolve(__dirname, "tests/__mocks__");

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
			{ find: "obsidian", replacement: `${mocks}/obsidian.ts` },
		],
	},
	test: {
		name: "@true-recall/obsidian",
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
