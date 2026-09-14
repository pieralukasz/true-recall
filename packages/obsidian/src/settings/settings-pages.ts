export const SETTINGS_PAGES = [
	{
		id: "general",
		name: "General",
		description:
			"Appearance, review behavior, keyboard shortcuts, and support.",
		searchAliases: [
			"AI provider",
			"review behavior",
			"answer buttons",
			"day start",
			"keyboard shortcuts",
		],
	},
	{
		id: "fsrs",
		name: "FSRS",
		description: "Scheduling presets, retention, limits, and optimization.",
		searchAliases: [
			"desired retention",
			"maximum interval",
			"scheduling",
			"presets",
			"load balancing",
			"easy days",
			"R-Mode",
			"sibling dispersal",
			"scheduled breaks",
		],
	},
	{
		id: "data",
		name: "Data & backup",
		description: "Database storage, backups, recovery, import, and export.",
		searchAliases: [
			"database",
			"storage",
			"backup",
			"recovery",
			"import",
			"export",
			"smart retention",
		],
	},
	{
		id: "integrations",
		name: "Integrations",
		description: "Obsidian Sync, shared vaults, Ink, and the local API.",
		searchAliases: [
			"sync",
			"Obsidian Sync",
			"cloud sync",
			"shared vault",
			"Ink",
			"local API",
		],
	},
	{
		id: "features",
		name: "Features",
		description: "Optional True Recall features and AI configuration.",
		searchAliases: ["plugins", "AI", "chat", "image occlusion"],
	},
] as const;

export type SettingsPageId = (typeof SETTINGS_PAGES)[number]["id"];
