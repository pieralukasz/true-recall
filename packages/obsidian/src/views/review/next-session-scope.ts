import type {
	SessionFilters,
	TemporaryCustomStudyDeck,
} from "@true-recall/core/types/review-session.types";

import type { CustomStudyModalScope } from "@true-recall/obsidian/modals/study/custom-study/types";

type ScopeFilters = Pick<
	SessionFilters,
	| "projectPath"
	| "sourceNoteFilters"
	| "sourceNoteFilter"
	| "sourceUidFilter"
	| "temporaryDeckId"
>;

function projectName(projectPath: string): string {
	return projectPath.split("/").pop()?.replace(/\.md$/, "") ?? projectPath;
}

function noteListScope(noteNames: string[]): CustomStudyModalScope {
	return {
		sourceNoteFilters: noteNames,
		scopeLabel:
			noteNames.length === 1 ? noteNames[0] : `${noteNames.length} notes`,
	};
}

/**
 * Scope for the Custom Study modal that "Next session" opens, so the next
 * session is picked from the same project or notes as the one that ended.
 * Returns undefined when the ended session had no project/note scope (or a
 * scope the modal cannot express, like a file path), which opens it unscoped.
 */
export function resolveNextSessionScope(
	filters: ScopeFilters,
	temporaryDecks: readonly TemporaryCustomStudyDeck[],
	resolveNoteName: (sourceUid: string) => string | undefined,
): CustomStudyModalScope | undefined {
	if (filters.temporaryDeckId) {
		const deck = temporaryDecks.find(
			(candidate) => candidate.id === filters.temporaryDeckId,
		);
		if (deck?.projectPath) {
			return {
				projectPath: deck.projectPath,
				scopeLabel: deck.scopeLabel ?? projectName(deck.projectPath),
			};
		}
		if (deck?.sourceNoteFilters?.length) {
			const scope = noteListScope(deck.sourceNoteFilters);
			return deck.scopeLabel
				? { ...scope, scopeLabel: deck.scopeLabel }
				: scope;
		}
		if (deck) return undefined;
	}

	if (filters.projectPath) {
		return {
			projectPath: filters.projectPath,
			scopeLabel: projectName(filters.projectPath),
		};
	}
	if (filters.sourceNoteFilters?.length) {
		return noteListScope(filters.sourceNoteFilters);
	}
	if (filters.sourceNoteFilter) {
		return noteListScope([filters.sourceNoteFilter]);
	}
	if (filters.sourceUidFilter) {
		const noteName = resolveNoteName(filters.sourceUidFilter);
		if (noteName) return noteListScope([noteName]);
	}
	return undefined;
}
