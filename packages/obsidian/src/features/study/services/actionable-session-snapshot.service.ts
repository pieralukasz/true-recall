// Re-export core types
export type {
	ActionableSessionSnapshot,
	ActionableSessionSnapshotOptions,
	INoteResolver,
} from "@true-recall/core/services/review/actionable-session-snapshot.service";

import {
	type ActionableSessionSnapshot,
	type ActionableSessionSnapshotOptions,
	type ActionableSessionSnapshotDeps as CoreDeps,
	computeActionableSessionSnapshot as coreCompute,
} from "@true-recall/core/services/review/actionable-session-snapshot.service";
import type { SessionFilters } from "@true-recall/core/types/review-session.types";
import type { MetadataCache } from "obsidian";

/** Obsidian-specific deps that accept MetadataCache directly */
export type ActionableSessionSnapshotDeps = Omit<CoreDeps, "noteResolver"> & {
	metadataCache?: MetadataCache;
};

/** Wrapper that adapts MetadataCache → INoteResolver for callers */
export function computeActionableSessionSnapshot(
	deps: ActionableSessionSnapshotDeps,
	filters: SessionFilters,
	options: ActionableSessionSnapshotOptions = {},
): ActionableSessionSnapshot {
	const { metadataCache, ...rest } = deps;
	const noteResolver = metadataCache
		? {
				resolveNotePath(noteName: string): string | null {
					const file = metadataCache.getFirstLinkpathDest(noteName, "");
					return file?.path ?? null;
				},
			}
		: undefined;
	return coreCompute({ ...rest, noteResolver }, filters, options);
}
