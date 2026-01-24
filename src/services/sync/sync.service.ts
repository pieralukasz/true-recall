/**
 * Supabase Sync Service
 * Synchronizes local SQLite data with Supabase cloud backend
 * using Last Write Wins (LWW) conflict resolution
 *
 * v15: Removed note_projects sync, simplified source_notes (no name/path)
 * Uses atomic `sync_all_data` RPC for all-or-nothing transactions
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthService } from "../auth";
import type { SqliteStoreService } from "../persistence/sqlite";
import type { FSRSCardData } from "../../types";
import type {
	SourceNoteForSync,
	ProjectForSync,
	CardImageRefForSync,
} from "../persistence/sqlite/modules/ProjectActions";
import type { ReviewLogForSync } from "../persistence/sqlite/modules/StatsActions";

/**
 * Result of a sync operation
 */
export interface SyncResult {
	success: boolean;
	error?: string;
	pulled: number;
	pushed: number;
}

/**
 * Options for sync operation
 */
export interface SyncOptions {
	/** Force full sync (ignore lastSyncTimestamp) */
	fullSync?: boolean;
}

/**
 * First sync status for conflict detection
 */
export interface FirstSyncStatus {
	/** True if this device has never synced before */
	isFirstSync: boolean;
	/** True if there are local cards/notes */
	hasLocalData: boolean;
	/** True if there are cards/notes on the server */
	hasRemoteData: boolean;
	/** True if both local and remote have data (conflict) */
	hasConflict: boolean;
}

/**
 * Remote card row from Supabase (snake_case)
 */
interface RemoteCardRow {
	id: string;
	due: string;
	stability: number;
	difficulty: number;
	reps: number;
	lapses: number;
	state: number;
	last_review: string | null;
	scheduled_days: number;
	learning_step: number;
	suspended: boolean;
	buried_until: string | null;
	created_at: number;
	updated_at: number;
	deleted_at: number | null;
	question: string | null;
	answer: string | null;
	source_uid: string | null;
}

/**
 * Remote source note row from Supabase (snake_case)
 * v15: Simplified - no name/path fields
 */
interface RemoteSourceNoteRow {
	uid: string;
	created_at: number;
	updated_at: number;
	deleted_at: number | null;
}

/**
 * Remote project row from Supabase (snake_case)
 */
interface RemoteProjectRow {
	id: string;
	name: string;
	created_at: number;
	updated_at: number;
	deleted_at: number | null;
}

/**
 * Remote review log row from Supabase (snake_case)
 */
interface RemoteReviewLogRow {
	id: string;
	card_id: string;
	reviewed_at: string;
	rating: number;
	scheduled_days: number;
	elapsed_days: number;
	state: number;
	time_spent_ms: number;
	updated_at: number;
	deleted_at: number | null;
}

/**
 * Remote card image ref row from Supabase (snake_case)
 */
interface RemoteCardImageRefRow {
	id: string;
	card_id: string;
	image_path: string;
	field: string;
	created_at: number;
	updated_at: number;
	deleted_at: number | null;
}

/**
 * Local card with sync fields (for push)
 */
interface LocalCardForSync extends FSRSCardData {
	updatedAt?: number;
	deletedAt?: number | null;
}

/**
 * Supabase sync service for cloud synchronization
 * v15: No note_projects sync (projects read from frontmatter)
 */
export class SyncService {
	private authService: AuthService;
	private cardStore: SqliteStoreService;

	constructor(authService: AuthService, cardStore: SqliteStoreService) {
		this.authService = authService;
		this.cardStore = cardStore;
	}

	/**
	 * Check if sync is available (authenticated and configured)
	 */
	isAvailable(): boolean {
		return this.authService.isConfigured();
	}

	/**
	 * Check first sync status for conflict detection (Anki-style)
	 * Used to determine if user needs to choose between upload/download
	 */
	async checkFirstSyncStatus(): Promise<FirstSyncStatus> {
		const hadPreviousSync = this.getLastSyncTimestamp() > 0;

		// If already synced before, no conflict detection needed
		if (hadPreviousSync) {
			return {
				isFirstSync: false,
				hasLocalData: false,
				hasRemoteData: false,
				hasConflict: false,
			};
		}

		// Check local data
		const localCards = this.cardStore.cards.getAll();
		const hasLocalData = localCards.length > 0;

		// Check remote data
		const client = this.authService.getClient();
		if (!client) {
			return {
				isFirstSync: true,
				hasLocalData,
				hasRemoteData: false,
				hasConflict: false,
			};
		}

		const { count } = await client
			.from("cards")
			.select("*", { count: "exact", head: true });
		const hasRemoteData = (count ?? 0) > 0;

		return {
			isFirstSync: true,
			hasLocalData,
			hasRemoteData,
			hasConflict: hasLocalData && hasRemoteData,
		};
	}

	/**
	 * Main sync method: Pull then Push (atomic)
	 */
	async sync(options: SyncOptions = {}): Promise<SyncResult> {
		const client = this.authService.getClient();
		if (!client) {
			return { success: false, error: "Not authenticated", pulled: 0, pushed: 0 };
		}

		const authState = await this.authService.getAuthState();
		if (!authState.isAuthenticated) {
			return { success: false, error: "Not logged in", pulled: 0, pushed: 0 };
		}

		try {
			const fullSync = options.fullSync ?? false;
			const lastSync = fullSync ? 0 : this.getLastSyncTimestamp();

			// 1. SNAPSHOT: Gather local changes BEFORE applying pulled data
			// This prevents just-pulled records from being pushed back
			const localChanges = this.gatherLocalChanges(lastSync);

			// 2. PULL: Fetch all tables from remote in parallel
			const pullResults = await this.pullAllTables(client, lastSync);

			// 3. Apply pulled data locally (LWW comparison)
			const pulled = this.applyPulledData(pullResults);

			// 4. Rebuild daily stats from synced review_log
			this.cardStore.stats.rebuildDailyStatsFromReviewLog();

			// 5. PUSH: Use pre-gathered local changes
			const pushed = await this.pushLocalChanges(client, localChanges);

			// 6. Update last sync timestamp
			const now = Date.now();
			this.setLastSyncTimestamp(now);

			return { success: true, pulled, pushed };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error("[SyncService] Sync failed:", error);
			return { success: false, error: message, pulled: 0, pushed: 0 };
		}
	}

	/**
	 * Pull all tables from Supabase in parallel
	 * v15: No note_projects table
	 */
	private async pullAllTables(client: SupabaseClient, lastSync: number): Promise<{
		cards: RemoteCardRow[];
		sourceNotes: RemoteSourceNoteRow[];
		projects: RemoteProjectRow[];
		reviewLog: RemoteReviewLogRow[];
		cardImageRefs: RemoteCardImageRefRow[];
	}> {
		// Note: Supabase default limit is 1000 rows - we need explicit high limit
		const [cardsRes, sourceNotesRes, projectsRes, reviewLogRes, cardImageRefsRes] =
			await Promise.all([
				client.from("cards").select("*").gt("updated_at", lastSync).limit(100000),
				client.from("source_notes").select("*").gt("updated_at", lastSync).limit(100000),
				client.from("projects").select("*").gt("updated_at", lastSync).limit(100000),
				client.from("review_log").select("*").gt("updated_at", lastSync).limit(100000),
				client.from("card_image_refs").select("*").gt("updated_at", lastSync).limit(100000),
			]);

		// Check for errors
		if (cardsRes.error) throw new Error(`Pull cards failed: ${cardsRes.error.message}`);
		if (sourceNotesRes.error) throw new Error(`Pull source_notes failed: ${sourceNotesRes.error.message}`);
		if (projectsRes.error) throw new Error(`Pull projects failed: ${projectsRes.error.message}`);
		if (reviewLogRes.error) throw new Error(`Pull review_log failed: ${reviewLogRes.error.message}`);
		if (cardImageRefsRes.error) throw new Error(`Pull card_image_refs failed: ${cardImageRefsRes.error.message}`);

		return {
			cards: (cardsRes.data ?? []) as RemoteCardRow[],
			sourceNotes: (sourceNotesRes.data ?? []) as RemoteSourceNoteRow[],
			projects: (projectsRes.data ?? []) as RemoteProjectRow[],
			reviewLog: (reviewLogRes.data ?? []) as RemoteReviewLogRow[],
			cardImageRefs: (cardImageRefsRes.data ?? []) as RemoteCardImageRefRow[],
		};
	}

	/**
	 * Apply pulled data locally using LWW conflict resolution
	 * Order: source_notes, projects first (independent), then dependent tables
	 * v15: No note_projects
	 */
	private applyPulledData(data: {
		cards: RemoteCardRow[];
		sourceNotes: RemoteSourceNoteRow[];
		projects: RemoteProjectRow[];
		reviewLog: RemoteReviewLogRow[];
		cardImageRefs: RemoteCardImageRefRow[];
	}): number {
		let pulled = 0;

		// 1. Source notes (independent)
		for (const remote of data.sourceNotes) {
			const local = this.cardStore.projects.getSourceNoteForSync(remote.uid);
			if (!local || remote.updated_at > local.updatedAt) {
				this.cardStore.projects.upsertSourceNoteFromRemote(this.mapRemoteSourceNoteToLocal(remote));
				pulled++;
			}
		}

		// 2. Projects (independent)
		for (const remote of data.projects) {
			const local = this.cardStore.projects.getProjectForSync(remote.id);
			if (!local || remote.updated_at > local.updatedAt) {
				this.cardStore.projects.upsertProjectFromRemote(this.mapRemoteProjectToLocal(remote));
				pulled++;
			}
		}

		// 3. Cards (depends on source_notes)
		for (const remote of data.cards) {
			const local = this.cardStore.cards.get(remote.id) as LocalCardForSync | undefined;
			const localUpdatedAt = local?.updatedAt ?? 0;
			if (!local || remote.updated_at > localUpdatedAt) {
				this.cardStore.cards.upsertFromRemote(this.mapRemoteCardToLocal(remote));
				pulled++;
			}
		}

		// 4. Review log (depends on cards)
		for (const remote of data.reviewLog) {
			const local = this.cardStore.stats.getReviewLogForSync(remote.id);
			if (!local || remote.updated_at > local.updatedAt) {
				this.cardStore.stats.upsertReviewLogFromRemote(this.mapRemoteReviewLogToLocal(remote));
				pulled++;
			}
		}

		// 5. Card image refs (depends on cards)
		for (const remote of data.cardImageRefs) {
			const local = this.cardStore.projects.getCardImageRefForSync(remote.id);
			if (!local || remote.updated_at > local.updatedAt) {
				this.cardStore.projects.upsertCardImageRefFromRemote(this.mapRemoteCardImageRefToLocal(remote));
				pulled++;
			}
		}

		return pulled;
	}

	/**
	 * Gathered local changes for push
	 * v15: No note_projects
	 */
	private gatherLocalChanges(lastSync: number): {
		sourceNotes: SourceNoteForSync[];
		projects: ProjectForSync[];
		cards: LocalCardForSync[];
		reviewLog: ReviewLogForSync[];
		cardImageRefs: CardImageRefForSync[];
	} {
		return {
			sourceNotes: this.cardStore.projects.getModifiedSourceNotesSince(lastSync),
			projects: this.cardStore.projects.getModifiedProjectsSince(lastSync),
			cards: this.cardStore.cards.getModifiedSince(lastSync),
			reviewLog: this.cardStore.stats.getModifiedReviewLogSince(lastSync),
			cardImageRefs: this.cardStore.projects.getModifiedCardImageRefsSince(lastSync),
		};
	}

	/**
	 * Push pre-gathered local changes to Supabase via atomic RPC
	 * v15: No note_projects
	 */
	private async pushLocalChanges(
		client: SupabaseClient,
		localChanges: {
			sourceNotes: SourceNoteForSync[];
			projects: ProjectForSync[];
			cards: LocalCardForSync[];
			reviewLog: ReviewLogForSync[];
			cardImageRefs: CardImageRefForSync[];
		}
	): Promise<number> {
		const { sourceNotes, projects, cards, reviewLog, cardImageRefs } = localChanges;

		const totalChanges =
			sourceNotes.length +
			projects.length +
			cards.length +
			reviewLog.length +
			cardImageRefs.length;

		if (totalChanges === 0) {
			return 0;
		}

		// Map to remote format (snake_case)
		// v15: note_projects is empty array for backwards compatibility with RPC
		const payload = {
			p_source_notes: sourceNotes.map((sn) => this.mapLocalSourceNoteToRemote(sn)),
			p_projects: projects.map((p) => this.mapLocalProjectToRemote(p)),
			p_cards: cards.map((c) => this.mapLocalCardToRemote(c)),
			p_note_projects: [], // v15: Empty - no longer syncing note-project relationships
			p_review_log: reviewLog.map((rl) => this.mapLocalReviewLogToRemote(rl)),
			p_card_image_refs: cardImageRefs.map((cir) => this.mapLocalCardImageRefToRemote(cir)),
		};

		// Single atomic RPC call
		const { error } = await client.rpc("sync_all_data", payload);

		if (error) {
			throw new Error(`Push failed: ${error.message}`);
		}

		return totalChanges;
	}

	/**
	 * Get last sync timestamp from META table
	 */
	getLastSyncTimestamp(): number {
		const value = this.cardStore.cards.getSyncMetadata("last_sync_timestamp");
		return value ? parseInt(value, 10) : 0;
	}

	/**
	 * Set last sync timestamp in META table
	 */
	private setLastSyncTimestamp(timestamp: number): void {
		this.cardStore.cards.setSyncMetadata("last_sync_timestamp", String(timestamp));
	}

	/**
	 * Force replace - deletes all data on server and uploads local database
	 * WARNING: Destructive operation! Overwrites everything on server.
	 */
	async forceReplace(): Promise<SyncResult> {
		const client = this.authService.getClient();
		if (!client) {
			return { success: false, error: "Not authenticated", pulled: 0, pushed: 0 };
		}

		const authState = await this.authService.getAuthState();
		if (!authState.isAuthenticated) {
			return { success: false, error: "Not logged in", pulled: 0, pushed: 0 };
		}

		try {
			// Gather ALL local data (not just modified)
			const allLocalData = this.gatherLocalChanges(0);

			// Map to remote format
			// v15: note_projects is empty array
			const payload = {
				p_source_notes: allLocalData.sourceNotes.map((sn) => this.mapLocalSourceNoteToRemote(sn)),
				p_projects: allLocalData.projects.map((p) => this.mapLocalProjectToRemote(p)),
				p_cards: allLocalData.cards.map((c) => this.mapLocalCardToRemote(c)),
				p_note_projects: [], // v15: Empty
				p_review_log: allLocalData.reviewLog.map((rl) => this.mapLocalReviewLogToRemote(rl)),
				p_card_image_refs: allLocalData.cardImageRefs.map((cir) => this.mapLocalCardImageRefToRemote(cir)),
			};

			// Call replace RPC (deletes all user data, then inserts fresh)
			const { data, error } = await client.rpc("replace_all_data", payload);

			if (error) {
				throw new Error(`Force replace failed: ${error.message}`);
			}

			// Check for SQL-level errors (caught by EXCEPTION in the function)
			if (data?.status === "error") {
				throw new Error(`Force replace SQL error: ${data.message}`);
			}

			// Update sync timestamp
			this.setLastSyncTimestamp(Date.now());

			const totalPushed =
				allLocalData.sourceNotes.length +
				allLocalData.projects.length +
				allLocalData.cards.length +
				allLocalData.reviewLog.length +
				allLocalData.cardImageRefs.length;

			return { success: true, pulled: 0, pushed: totalPushed };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error("[SyncService] Force replace failed:", error);
			return { success: false, error: message, pulled: 0, pushed: 0 };
		}
	}

	/**
	 * Force pull - deletes all local data and downloads from server
	 * WARNING: Destructive operation! Overwrites local database.
	 */
	async forcePull(): Promise<SyncResult> {
		const client = this.authService.getClient();
		if (!client) {
			return { success: false, error: "Not authenticated", pulled: 0, pushed: 0 };
		}

		const authState = await this.authService.getAuthState();
		if (!authState.isAuthenticated) {
			return { success: false, error: "Not logged in", pulled: 0, pushed: 0 };
		}

		try {
			// 1. Delete ALL local data
			this.deleteAllLocalData();

			// 2. Pull ALL data from server (timestamp 0 = everything)
			const pullResults = await this.pullAllTables(client, 0);

			// 3. Apply pulled data locally (no LWW needed - local is empty)
			let pulled = 0;

			// Source notes (independent - must come first)
			for (const remote of pullResults.sourceNotes) {
				this.cardStore.projects.upsertSourceNoteFromRemote(this.mapRemoteSourceNoteToLocal(remote));
				pulled++;
			}

			// Projects (independent - must come first)
			for (const remote of pullResults.projects) {
				this.cardStore.projects.upsertProjectFromRemote(this.mapRemoteProjectToLocal(remote));
				pulled++;
			}

			// Cards (depends on source_notes)
			for (const remote of pullResults.cards) {
				this.cardStore.cards.upsertFromRemote(this.mapRemoteCardToLocal(remote));
				pulled++;
			}

			// Review log (depends on cards)
			for (const remote of pullResults.reviewLog) {
				this.cardStore.stats.upsertReviewLogFromRemote(this.mapRemoteReviewLogToLocal(remote));
				pulled++;
			}

			// Card image refs (depends on cards)
			for (const remote of pullResults.cardImageRefs) {
				this.cardStore.projects.upsertCardImageRefFromRemote(this.mapRemoteCardImageRefToLocal(remote));
				pulled++;
			}

			// 4. Rebuild daily stats from synced review_log
			this.cardStore.stats.rebuildDailyStatsFromReviewLog();

			// 5. Update sync timestamp
			this.setLastSyncTimestamp(Date.now());

			return { success: true, pulled, pushed: 0 };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error("[SyncService] Force pull failed:", error);
			return { success: false, error: message, pulled: 0, pushed: 0 };
		}
	}

	/**
	 * Delete all local sync-able data
	 */
	private deleteAllLocalData(): void {
		// Order matters - delete dependent tables first
		this.cardStore.stats.deleteAllReviewLogForSync();
		this.cardStore.projects.deleteAllForSync();
		this.cardStore.cards.deleteAllForSync();
	}

	// ===== Remote to Local Mappers (snake_case -> camelCase) =====

	private mapRemoteCardToLocal(remote: RemoteCardRow): LocalCardForSync {
		return {
			id: remote.id,
			due: remote.due,
			stability: remote.stability,
			difficulty: remote.difficulty,
			reps: remote.reps,
			lapses: remote.lapses,
			state: remote.state,
			lastReview: remote.last_review,
			scheduledDays: remote.scheduled_days,
			learningStep: remote.learning_step,
			suspended: remote.suspended,
			buriedUntil: remote.buried_until ?? undefined,
			createdAt: remote.created_at,
			updatedAt: remote.updated_at,
			deletedAt: remote.deleted_at,
			question: remote.question ?? undefined,
			answer: remote.answer ?? undefined,
			sourceUid: remote.source_uid ?? undefined,
		};
	}

	/**
	 * Map remote source note to local format
	 * v15: No name/path fields
	 */
	private mapRemoteSourceNoteToLocal(remote: RemoteSourceNoteRow): SourceNoteForSync {
		return {
			uid: remote.uid,
			createdAt: remote.created_at,
			updatedAt: remote.updated_at,
			deletedAt: remote.deleted_at,
		};
	}

	private mapRemoteProjectToLocal(remote: RemoteProjectRow): ProjectForSync {
		return {
			id: remote.id,
			name: remote.name,
			createdAt: remote.created_at,
			updatedAt: remote.updated_at,
			deletedAt: remote.deleted_at,
		};
	}

	private mapRemoteReviewLogToLocal(remote: RemoteReviewLogRow): ReviewLogForSync {
		return {
			id: remote.id,
			cardId: remote.card_id,
			reviewedAt: remote.reviewed_at,
			rating: remote.rating,
			scheduledDays: remote.scheduled_days,
			elapsedDays: remote.elapsed_days,
			state: remote.state,
			timeSpentMs: remote.time_spent_ms,
			updatedAt: remote.updated_at,
			deletedAt: remote.deleted_at,
		};
	}

	private mapRemoteCardImageRefToLocal(remote: RemoteCardImageRefRow): CardImageRefForSync {
		return {
			id: remote.id,
			cardId: remote.card_id,
			imagePath: remote.image_path,
			field: remote.field,
			createdAt: remote.created_at,
			updatedAt: remote.updated_at,
			deletedAt: remote.deleted_at,
		};
	}

	// ===== Local to Remote Mappers (camelCase -> snake_case) =====

	private mapLocalCardToRemote(local: LocalCardForSync): Record<string, unknown> {
		return {
			id: local.id,
			due: local.due,
			stability: local.stability,
			difficulty: local.difficulty,
			reps: local.reps,
			lapses: local.lapses,
			state: local.state,
			last_review: local.lastReview ?? null,
			scheduled_days: local.scheduledDays,
			learning_step: local.learningStep,
			suspended: local.suspended ?? false,
			buried_until: local.buriedUntil ?? null,
			created_at: local.createdAt || Date.now(),
			updated_at: local.updatedAt || Date.now(),
			deleted_at: local.deletedAt ?? null,
			question: local.question ?? null,
			answer: local.answer ?? null,
			source_uid: local.sourceUid ?? null,
		};
	}

	/**
	 * Map local source note to remote format
	 * v15: No name/path fields
	 */
	private mapLocalSourceNoteToRemote(local: SourceNoteForSync): Record<string, unknown> {
		return {
			uid: local.uid,
			created_at: local.createdAt || Date.now(),
			updated_at: local.updatedAt || Date.now(),
			deleted_at: local.deletedAt,
		};
	}

	private mapLocalProjectToRemote(local: ProjectForSync): Record<string, unknown> {
		return {
			id: local.id,
			name: local.name,
			created_at: local.createdAt || Date.now(),
			updated_at: local.updatedAt || Date.now(),
			deleted_at: local.deletedAt,
		};
	}

	private mapLocalReviewLogToRemote(local: ReviewLogForSync): Record<string, unknown> {
		return {
			id: local.id,
			card_id: local.cardId,
			reviewed_at: local.reviewedAt,
			rating: local.rating,
			scheduled_days: local.scheduledDays,
			elapsed_days: local.elapsedDays,
			state: local.state,
			time_spent_ms: local.timeSpentMs,
			updated_at: local.updatedAt || Date.now(),
			deleted_at: local.deletedAt,
		};
	}

	private mapLocalCardImageRefToRemote(local: CardImageRefForSync): Record<string, unknown> {
		return {
			id: local.id,
			card_id: local.cardId,
			image_path: local.imagePath,
			field: local.field,
			created_at: local.createdAt || Date.now(),
			updated_at: local.updatedAt || Date.now(),
			deleted_at: local.deletedAt,
		};
	}
}
