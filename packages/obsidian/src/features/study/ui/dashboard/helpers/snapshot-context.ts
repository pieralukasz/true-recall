import type { SessionPersistenceService } from "@true-recall/core/persistence/session/session-persistence.service";
import {
	captureSessionProgress,
	type SessionProgressSnapshot,
} from "@true-recall/core/services/review/session-helpers";

import type { ActionableSessionSnapshot } from "@true-recall/obsidian/features/study/services/actionable-session-snapshot.service";

/**
 * Shared state for every session snapshot computed during one dashboard pass.
 *
 * The cache is keyed by session filters only, so the note, project and global
 * snapshots of a single render can share it. The progress snapshot pins
 * today's counters so all of them see the same remaining budget.
 */
export interface DashboardSnapshotContext {
	cache: Map<string, ActionableSessionSnapshot>;
	sessionProgress: SessionProgressSnapshot;
}

export function createDashboardSnapshotContext(
	sessionPersistence: SessionPersistenceService,
): DashboardSnapshotContext {
	return {
		cache: new Map(),
		sessionProgress: captureSessionProgress(sessionPersistence),
	};
}
