import type { App } from "obsidian";
import type { FSRSFlashcardItem } from "../../../types";

export interface CardFilterOptions {
	stateFilter?: "due" | "learning" | "new" | "buried";
}

/**
 * Returns active (non-suspended, non-buried) cards, or specifically
 * buried cards if stateFilter is "buried"
 */
export function filterActiveCards(
	cards: FSRSFlashcardItem[],
	options: CardFilterOptions = {}
): FSRSFlashcardItem[] {
	const now = new Date();
	const { stateFilter } = options;

	return cards.filter((card) => {
		// Skip suspended cards always
		if (card.fsrs.suspended) return false;

		// If reviewing buried cards, ONLY include buried
		if (stateFilter === "buried") {
			if (!card.fsrs.buriedUntil) return false;
			return new Date(card.fsrs.buriedUntil) > now;
		}

		// Normal mode: exclude buried cards
		if (card.fsrs.buriedUntil) {
			const buriedUntil = new Date(card.fsrs.buriedUntil);
			if (buriedUntil > now) return false;
		}

		return true;
	});
}

/**
 * Build a map of source UIDs to their project names.
 * Used for project filtering when cards don't have projects directly.
 * Returns undefined if projectFilters is empty.
 */
export function buildSourceUidToProjectsMap(
	app: App,
	projectFilters: string[] | undefined
): Map<string, string[]> | undefined {
	if (!projectFilters || projectFilters.length === 0) {
		return undefined;
	}

	const sourceUidToProjects = new Map<string, string[]>();
	const files = app.vault.getMarkdownFiles();

	// Helper to normalize project names (strip [[...]] wiki-link brackets)
	const normalizeProjectName = (name: string): string =>
		name.replace(/^\[\[|\]\]$/g, "");

	for (const file of files) {
		const cache = app.metadataCache.getFileCache(file);
		const frontmatter = cache?.frontmatter;
		if (!frontmatter) continue;

		const uid = frontmatter.flashcard_uid as string | undefined;
		const rawProjects = frontmatter.projects as unknown[];
		const projects = Array.isArray(rawProjects)
			? rawProjects.map(normalizeProjectName)
			: [];

		if (uid && projects.length > 0) {
			sourceUidToProjects.set(uid, projects);
		}
	}

	return sourceUidToProjects;
}

export function getEmptyQueueMessage(
	stateFilter?: string,
	projectFilters?: string[]
): string {
	if (stateFilter === "buried") {
		return "No buried cards found.";
	}

	if (projectFilters && projectFilters.length > 0) {
		return "No cards due for review in selected projects.";
	}

	return "Congratulations! No cards due for review.";
}
