/**
 * Supabase Sync Service
 * Synchronizes local SQLite data with Supabase cloud backend
 * using Last Write Wins (LWW) conflict resolution
 *
 * Uses atomic `sync_all_data` RPC for all-or-nothing transactions
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthService } from "../auth";
import type { SqliteStoreService } from "../persistence/sqlite";
import type {
	FSRSCardData,
	SyncResult,
	SyncOptions,
	FirstSyncStatus,
} from "../../types";
import type { ReviewLogForSync } from "../persistence/sqlite/modules/StatsActions";

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
 * Remote review log row from Supabase (snake_case)
 */
interface RemoteReviewLogRow {
	id: string;
	card_id: string;
	reviewed_at: string | number; // Can be ISO string or bigint timestamp from Supabase
	rating: number;
	scheduled_days: number;
	elapsed_days: number;
	state: number;
	time_spent_ms: number;
	updated_at: number;
	deleted_at: number | null;
}

/**
 * Response from sync_all_data/replace_all_data RPC
 * The functions return 'success' on success, 'error' on failure
 */
interface SyncRpcResponse {
	status: "success" | "error";
	message?: string;
	time?: string;
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
			return {
				success: false,
				error: "Not authenticated",
				pulled: 0,
				pushed: 0,
			};
		}

		const authState = await this.authService.getAuthState();
		if (!authState.isAuthenticated) {
			return {
				success: false,
				error: "Not logged in",
				pulled: 0,
				pushed: 0,
			};
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
			const message =
				error instanceof Error ? error.message : String(error);
			console.error("[SyncService] Sync failed:", error);
			return { success: false, error: message, pulled: 0, pushed: 0 };
		}
	}

	/**
	 * Pull all tables from Supabase in parallel
	 */
	private async pullAllTables(
		client: SupabaseClient,
		lastSync: number
	): Promise<{
		cards: RemoteCardRow[];
		reviewLog: RemoteReviewLogRow[];
	}> {
		// Note: Supabase default limit is 1000 rows - we need explicit high limit
		const [cardsRes, reviewLogRes] = await Promise.all([
			client
				.from("cards")
				.select("*")
				.gt("updated_at", lastSync)
				.limit(100000),
			client
				.from("review_log")
				.select("*")
				.gt("updated_at", lastSync)
				.limit(100000),
		]);

		// Check for errors
		if (cardsRes.error)
			throw new Error(`Pull cards failed: ${cardsRes.error.message}`);
		if (reviewLogRes.error)
			throw new Error(
				`Pull review_log failed: ${reviewLogRes.error.message}`
			);

		return {
			cards: (cardsRes.data ?? []) as RemoteCardRow[],
			reviewLog: (reviewLogRes.data ?? []) as RemoteReviewLogRow[],
		};
	}

	/**
	 * Apply pulled data locally using LWW conflict resolution
	 */
	private applyPulledData(data: {
		cards: RemoteCardRow[];
		reviewLog: RemoteReviewLogRow[];
	}): number {
		let pulled = 0;

		// 1. Cards
		for (const remote of data.cards) {
			const local = this.cardStore.cards.get(remote.id) as
				| LocalCardForSync
				| undefined;
			const localUpdatedAt = local?.updatedAt ?? 0;
			if (!local || remote.updated_at > localUpdatedAt) {
				this.cardStore.cards.upsertFromRemote(
					this.mapRemoteCardToLocal(remote)
				);
				pulled++;
			}
		}

		// 2. Review log (depends on cards)
		for (const remote of data.reviewLog) {
			const local = this.cardStore.stats.getReviewLogForSync(remote.id);
			if (!local || remote.updated_at > local.updatedAt) {
				this.cardStore.stats.upsertReviewLogFromRemote(
					this.mapRemoteReviewLogToLocal(remote)
				);
				pulled++;
			}
		}

		return pulled;
	}

	/**
	 * Gathered local changes for push
	 */
	private gatherLocalChanges(lastSync: number): {
		cards: LocalCardForSync[];
		reviewLog: ReviewLogForSync[];
	} {
		return {
			cards: this.cardStore.cards.getModifiedSince(lastSync),
			reviewLog: this.cardStore.stats.getModifiedReviewLogSince(lastSync),
		};
	}

	/**
	 * Push pre-gathered local changes to Supabase via atomic RPC
	 */
	private async pushLocalChanges(
		client: SupabaseClient,
		localChanges: {
			cards: LocalCardForSync[];
			reviewLog: ReviewLogForSync[];
		}
	): Promise<number> {
		const { cards, reviewLog } = localChanges;

		const totalChanges = cards.length + reviewLog.length;

		if (totalChanges === 0) {
			return 0;
		}

		// Map to remote format (snake_case)
		const payload = {
			p_cards: cards.map((c) => this.mapLocalCardToRemote(c)),
			p_review_log: reviewLog.map((rl) =>
				this.mapLocalReviewLogToRemote(rl)
			),
		};

		// Single atomic RPC call
		const { data, error } = await client.rpc("sync_all_data", payload);

		if (error) {
			throw new Error(`Push failed: ${error.message}`);
		}

		// Check response from RPC function (catches SQL-level errors)
		const response = data as SyncRpcResponse | null;
		if (response?.status === "error") {
			throw new Error(
				`Push RPC error: ${response.message ?? "Unknown error"}`
			);
		}

		return totalChanges;
	}

	/**
	 * Get last sync timestamp from META table
	 */
	getLastSyncTimestamp(): number {
		const value = this.cardStore.cards.getSyncMetadata(
			"last_sync_timestamp"
		);
		return value ? parseInt(value, 10) : 0;
	}

	/**
	 * Set last sync timestamp in META table
	 */
	private setLastSyncTimestamp(timestamp: number): void {
		this.cardStore.cards.setSyncMetadata(
			"last_sync_timestamp",
			String(timestamp)
		);
	}

	/**
	 * Force replace - deletes all data on server and uploads local database
	 * WARNING: Destructive operation! Overwrites everything on server.
	 */
	async forceReplace(): Promise<SyncResult> {
		const client = this.authService.getClient();
		if (!client) {
			return {
				success: false,
				error: "Not authenticated",
				pulled: 0,
				pushed: 0,
			};
		}

		const authState = await this.authService.getAuthState();
		if (!authState.isAuthenticated) {
			return {
				success: false,
				error: "Not logged in",
				pulled: 0,
				pushed: 0,
			};
		}

		try {
			// Gather ALL local data (not just modified)
			const allLocalData = this.gatherLocalChanges(0);

			// Map to remote format
			const payload = {
				p_cards: allLocalData.cards.map((c) =>
					this.mapLocalCardToRemote(c)
				),
				p_review_log: allLocalData.reviewLog.map((rl) =>
					this.mapLocalReviewLogToRemote(rl)
				),
			};

			// Call replace RPC (deletes all user data, then inserts fresh)
			const { data, error } = await client.rpc(
				"replace_all_data",
				payload
			);

			if (error) {
				throw new Error(`Force replace failed: ${error.message}`);
			}

			// Check response from RPC function (catches SQL-level errors)
			const response = data as SyncRpcResponse | null;
			if (response?.status === "error") {
				throw new Error(
					`Force replace RPC error: ${
						response.message ?? "Unknown error"
					}`
				);
			}

			// Update sync timestamp
			this.setLastSyncTimestamp(Date.now());

			const totalPushed =
				allLocalData.cards.length + allLocalData.reviewLog.length;

			return { success: true, pulled: 0, pushed: totalPushed };
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
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
			return {
				success: false,
				error: "Not authenticated",
				pulled: 0,
				pushed: 0,
			};
		}

		const authState = await this.authService.getAuthState();
		if (!authState.isAuthenticated) {
			return {
				success: false,
				error: "Not logged in",
				pulled: 0,
				pushed: 0,
			};
		}

		try {
			// 1. Delete ALL local data
			this.deleteAllLocalData();

			// 2. Pull ALL data from server (timestamp 0 = everything)
			const pullResults = await this.pullAllTables(client, 0);

			// 3. Apply pulled data locally (no LWW needed - local is empty)
			let pulled = 0;

			// v18: Card image refs removed
			// v17: Source notes removed - metadata resolved from vault
			// v16: Projects removed - they come from frontmatter only

			// Cards
			for (const remote of pullResults.cards) {
				this.cardStore.cards.upsertFromRemote(
					this.mapRemoteCardToLocal(remote)
				);
				pulled++;
			}

			// Review log (depends on cards)
			for (const remote of pullResults.reviewLog) {
				this.cardStore.stats.upsertReviewLogFromRemote(
					this.mapRemoteReviewLogToLocal(remote)
				);
				pulled++;
			}

			// 4. Rebuild daily stats from synced review_log
			this.cardStore.stats.rebuildDailyStatsFromReviewLog();

			// 5. Update sync timestamp
			this.setLastSyncTimestamp(Date.now());

			return { success: true, pulled, pushed: 0 };
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
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

	private mapRemoteReviewLogToLocal(
		remote: RemoteReviewLogRow
	): ReviewLogForSync {
		// Convert bigint timestamp back to ISO string with validation
		let reviewedAt: string;
		if (typeof remote.reviewed_at === "number") {
			// Validate: timestamp must be after year 2000 (946684800000 ms)
			if (remote.reviewed_at < 946684800000) {
				throw new Error(
					`Invalid reviewed_at timestamp: ${remote.reviewed_at}`
				);
			}
			reviewedAt = new Date(remote.reviewed_at).toISOString();
		} else if (typeof remote.reviewed_at === "string") {
			reviewedAt = remote.reviewed_at;
		} else {
			throw new Error(
				`Invalid reviewed_at type: ${typeof remote.reviewed_at}`
			);
		}

		// Validate ISO format (YYYY-MM-DDTHH:MM:SS...)
		if (!/^\d{4}-\d{2}-\d{2}T/.test(reviewedAt)) {
			throw new Error(`Invalid ISO date format: ${reviewedAt}`);
		}

		return {
			id: remote.id,
			cardId: remote.card_id,
			reviewedAt,
			rating: remote.rating,
			scheduledDays: remote.scheduled_days,
			elapsedDays: remote.elapsed_days,
			state: remote.state,
			timeSpentMs: remote.time_spent_ms,
			updatedAt: remote.updated_at,
			deletedAt: remote.deleted_at,
		};
	}

	// ===== Local to Remote Mappers (camelCase -> snake_case) =====

	private mapLocalCardToRemote(
		local: LocalCardForSync
	): Record<string, unknown> {
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

	private mapLocalReviewLogToRemote(
		local: ReviewLogForSync
	): Record<string, unknown> {
		return {
			id: local.id,
			card_id: local.cardId,
			reviewed_at: new Date(local.reviewedAt).getTime(),
			rating: local.rating,
			scheduled_days: local.scheduledDays,
			elapsed_days: local.elapsedDays,
			state: local.state,
			time_spent_ms: local.timeSpentMs,
			updated_at: local.updatedAt || Date.now(),
			deleted_at: local.deletedAt,
		};
	}
}
