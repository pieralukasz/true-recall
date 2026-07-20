import type { App, TFile } from "obsidian";

import type { DailyNoteInfo } from "@true-recall/core/rag/ingestion/daily-note-preprocessor";

/** Moment instance type derived from Obsidian's bundled moment global. */
type Moment = ReturnType<NonNullable<typeof window.moment>>;

const NOT_DAILY: DailyNoteInfo = {
	isDailyNote: false,
	date: null,
	displayDate: null,
	dayOfWeek: null,
};

const COMMON_DATE_FORMATS = [
	"YYYY-MM-DD",
	"DD-MM-YYYY",
	"MM-DD-YYYY",
	"YYYY.MM.DD",
	"DD.MM.YYYY",
	"YYYY_MM_DD",
	"YYYYMMDD",
	"D MMMM YYYY",
	"MMMM D, YYYY",
	"DD MMM YYYY",
];

function buildResult(m: Moment): DailyNoteInfo {
	return {
		isDailyNote: true,
		date: m.format("YYYY-MM-DD"),
		displayDate: m.format("MMMM D, YYYY"),
		dayOfWeek: m.format("dddd"),
	};
}

function getDailyNotesPluginConfig(app: App): {
	folder: string;
	format: string;
} | null {
	try {
		const internal = (app as unknown as Record<string, unknown>)
			.internalPlugins as
			| {
					getPluginById(id: string): {
						enabled: boolean;
						instance?: { options?: { folder?: string; format?: string } };
					} | null;
			  }
			| undefined;

		const plugin = internal?.getPluginById("daily-notes");
		if (plugin?.enabled && plugin.instance?.options) {
			const { folder, format } = plugin.instance.options;
			if (folder) return { folder, format: format || "YYYY-MM-DD" };
		}
	} catch {
		// Plugin API may not be available
	}
	return null;
}

function tryParseDate(basename: string, format?: string): Moment | null {
	const m = window.moment;
	if (!m) return null;

	if (format) {
		const parsed = m(basename, format, true);
		if (parsed.isValid()) return parsed;
	}

	for (const fmt of COMMON_DATE_FORMATS) {
		const parsed = m(basename, fmt, true);
		if (parsed.isValid()) return parsed;
	}

	return null;
}

/**
 * Detect whether a file is a daily note by checking Obsidian's Daily Notes
 * plugin config, an explicit folder override, or common date filename patterns.
 */
export function detectDailyNote(
	app: App,
	file: TFile,
	dailyNotesFolder?: string,
): DailyNoteInfo {
	const basename = file.basename;
	const parentPath = file.parent?.path ?? "";

	// 1. Explicit folder override from settings
	if (dailyNotesFolder) {
		if (
			parentPath === dailyNotesFolder ||
			parentPath.startsWith(`${dailyNotesFolder}/`)
		) {
			const parsed = tryParseDate(basename);
			if (parsed) return buildResult(parsed);
		}
		// If folder is set but file isn't in it, not a daily note
		return NOT_DAILY;
	}

	// 2. Obsidian Daily Notes plugin config
	const pluginConfig = getDailyNotesPluginConfig(app);
	if (pluginConfig) {
		const configFolder = pluginConfig.folder.replace(/^\/|\/$/g, "");
		if (
			parentPath === configFolder ||
			parentPath.startsWith(`${configFolder}/`)
		) {
			const parsed = tryParseDate(basename, pluginConfig.format);
			if (parsed) return buildResult(parsed);
		}
		return NOT_DAILY;
	}

	// 3. Fallback: try parsing filename as date regardless of folder
	const parsed = tryParseDate(basename);
	if (parsed) return buildResult(parsed);

	return NOT_DAILY;
}
