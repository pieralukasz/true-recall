import type { KnipConfig } from "knip";

const config: KnipConfig = {
	workspaces: {
		".": {
			entry: ["esbuild.config.mjs", "version-bump.mjs", "scripts/*.ts"],
			project: ["esbuild.config.mjs", "version-bump.mjs", "scripts/**/*.ts"],
			ignore: ["main.js", "docs/**"],
			ignoreDependencies: [
				"excalirender", // used via bunx, not imported
				"@tailwindcss/cli", // used via bunx in esbuild.config
			],
		},
		"packages/core": {
			entry: ["src/index.ts", "src/**/index.ts"],
			project: ["src/**/*.ts"],
			ignore: ["dist/**"],
		},
		"packages/obsidian": {
			entry: [
				"src/main.ts",
				"src/index.ts",
				"src/editor/shared/embedded-editor.ts", // dynamically imported
			],
			project: ["src/**/*.{ts,tsx}"],
			ignoreDependencies: [
				"obsidian", // types-only peer dependency, externalized in build
			],
		},
	},
	ignore: ["**/dist/**", "**/coverage/**", "cli/**", "mcp-server/**"],
	ignoreDependencies: ["tslib"],
	ignoreExportsUsedInFile: true,
};

export default config;
