import tsparser from "@typescript-eslint/parser";
import obsidianmd from "eslint-plugin-obsidianmd";
import reactHooks from "eslint-plugin-react-hooks";

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
		plugins: { "react-hooks": reactHooks },
		rules: {
			// Shared frontend dependencies (preact, chart.js, etc.) are declared once
			// at the workspace root and hoisted — each package's own package.json only
			// lists what's unique to it. Point the rule at every manifest in the
			// monorepo instead of just the nearest one.
			"import/no-extraneous-dependencies": [
				"error",
				{
					packageDir: [
						import.meta.dirname,
						`${import.meta.dirname}/packages/core`,
						`${import.meta.dirname}/packages/obsidian`,
						`${import.meta.dirname}/packages/plugins`,
						`${import.meta.dirname}/mcp-server`,
					],
				},
			],
			// The recommended config references this rule (several files already
			// have justified `eslint-disable-next-line react-hooks/exhaustive-deps`
			// comments) but doesn't bundle the plugin that implements it. Register
			// only this one rule — the rest of eslint-plugin-react-hooks v7 targets
			// the React Compiler and doesn't apply to this Preact codebase.
			"react-hooks/exhaustive-deps": "warn",
			// no-undef duplicates what tsc already checks, and produces false
			// positives on TS global types (AsyncGenerator) and namespace-style
			// type references (preact.X, moment.X) that it isn't aware of.
			// typescript-eslint's own docs recommend disabling it for this reason.
			"no-undef": "off",
		},
	},
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
	{
		files: ["mcp-server/**/*.ts"],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				project: "./mcp-server/tsconfig.json",
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
];
