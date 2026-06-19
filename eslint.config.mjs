import tsparser from "@typescript-eslint/parser";
import obsidianmd from "eslint-plugin-obsidianmd";

// Obsidian's automated plugin review runs `eslint-plugin-obsidianmd`'s recommended
// config, which applies @typescript-eslint type-aware rules. Type-aware rules crash
// ("parserOptions.project" / "Oops! Something went wrong!") on any file that is not
// part of the TypeScript project. The root tsconfig.json only includes
// `packages/{core,obsidian,plugins}/src`, so everything else (tests, the CLI, the
// MCP server, build scripts, generated bundles) must be ignored or the whole scan
// aborts with a fatal error.
export default [
	{
		ignores: [
			"**/node_modules/**",
			".worktrees/**",
			".opencode/**",
			".venv/**",
			".github/**",
			"coverage/**",
			"**/dist/**",
			"**/*.d.ts",
			"docs/**",
			"assets/**",
			"main.js",
			"sql-wasm.wasm",
			"sqlite3.wasm",
			// The recommended config applies a type-aware plugin rule to package.json,
			// which has no type information and crashes the run. We don't lint it.
			"package.json",
			// Plain JS / config scripts are not part of the TS project.
			"**/*.js",
			"**/*.cjs",
			"**/*.mjs",
			"**/*.jsx",
			// Auxiliary interfaces compiled with their own tsconfigs.
			"cli/**",
			"mcp-server/**",
			"scripts/**",
			// Tests and root tooling configs are excluded from the root tsconfig.
			"packages/*/tests/**",
			"**/*.test.ts",
			"**/*.test.tsx",
			"knip.ts",
			"**/vitest.config.ts",
			"**/vitest.workspace.ts",
			"version-bump.mjs",
		],
	},
	...obsidianmd.configs.recommended,
	{
		files: [
			"packages/core/src/**/*.ts",
			"packages/core/src/**/*.tsx",
			"packages/obsidian/src/**/*.ts",
			"packages/obsidian/src/**/*.tsx",
			"packages/plugins/src/**/*.ts",
			"packages/plugins/src/**/*.tsx",
		],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				project: "./tsconfig.json",
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
];
