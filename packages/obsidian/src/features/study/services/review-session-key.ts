import type { SessionConfig } from "@true-recall/core/types/session-config.types";

interface SessionCardIdentity {
	sourceUid?: string;
	sourceNoteName?: string;
}

interface ReviewSessionLabelOptions {
	customDeckName?: string;
}

function stableStringify(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map(stableStringify).join(",")}]`;
	}
	if (!value || typeof value !== "object") {
		return JSON.stringify(value) ?? "null";
	}

	const entries = Object.entries(value)
		.filter(([, child]) => child !== undefined)
		.sort(([left], [right]) => left.localeCompare(right));
	return `{${entries
		.map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
		.join(",")}}`;
}

function getNormalSessionOptions(config: SessionConfig): string {
	return stableStringify({
		cardLimit: config.cardLimit,
		reviewOrder: config.reviewOrder,
	});
}

function getNoteScopeKey(
	noteNames: string[],
	cards: readonly SessionCardIdentity[],
): string {
	const names = new Set(noteNames);
	const sourceUids = new Set<string>();
	for (const card of cards) {
		if (card.sourceUid && names.has(card.sourceNoteName ?? "")) {
			sourceUids.add(card.sourceUid);
		}
	}

	const scope =
		sourceUids.size > 0
			? [...sourceUids].sort().map((uid) => `uid:${uid}`)
			: [...names].sort().map((name) => `name:${name}`);
	return scope.join("|");
}

function getProjectName(projectPath: string): string {
	return projectPath.split("/").pop()?.replace(/\.md$/, "") ?? projectPath;
}

function getNoteNameByUid(
	sourceUid: string,
	cards: readonly SessionCardIdentity[],
): string | undefined {
	return cards.find((card) => card.sourceUid === sourceUid)?.sourceNoteName;
}

/** Short, human-readable source shown in the Obsidian tab title. */
export function createReviewSessionLabel(
	config: SessionConfig,
	cards: readonly SessionCardIdentity[],
	options: ReviewSessionLabelOptions = {},
): string {
	switch (config.mode) {
		case "all_due":
			return "Today";
		case "note":
			return getNoteNameByUid(config.sourceUid, cards) ?? "Current note";
		case "notes":
			return config.noteNames.length === 1
				? (config.noteNames[0] ?? "Selected note")
				: `${config.noteNames.length} selected notes`;
		case "project":
			return `Project: ${getProjectName(config.projectPath)}`;
		case "created_today":
			return "Created today";
		case "weak_cards":
			return config.sourceNoteFilter
				? `Weak cards: ${config.sourceNoteFilter}`
				: "Weak cards";
		case "overdue":
			return "Overdue";
		case "study_ahead":
			return `Study ahead: ${config.days}d`;
		case "custom":
			return options.customDeckName ?? "Custom study";
	}
}

/** Stable identity of the launcher that owns an open review session. */
export function createReviewSessionKey(
	config: SessionConfig,
	cards: readonly SessionCardIdentity[],
): string {
	const normalOptions = getNormalSessionOptions(config);

	switch (config.mode) {
		case "all_due":
			return `all-due:${normalOptions}`;
		case "note":
			return `notes:uid:${config.sourceUid}:all:${normalOptions}`;
		case "notes": {
			const scope = getNoteScopeKey(config.noteNames, cards);
			return `notes:${scope}:${config.dueOnly ? "due-only" : "all"}:${normalOptions}`;
		}
		case "project":
			return `project:${config.projectPath}:${normalOptions}`;
		case "created_today":
			return `created-today:${normalOptions}`;
		case "weak_cards":
			return `weak:${config.sourceNoteFilter ?? "all"}:${normalOptions}`;
		case "overdue":
			return `overdue:${normalOptions}`;
		case "study_ahead":
			return `study-ahead:${config.days}:${normalOptions}`;
		case "custom":
			return config.temporaryDeckId
				? `custom-deck:${config.temporaryDeckId}`
				: `custom:${stableStringify(config)}`;
	}
}
