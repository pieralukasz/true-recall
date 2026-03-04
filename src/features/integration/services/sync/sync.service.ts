import type { SqliteStoreService } from "@features/core/persistence/sqlite";
import type { ReviewLogForSync } from "@features/core/persistence/sqlite/modules/StatsActions";
import type { AuthService } from "@features/integration/services/sync/auth.service";
import type {
	LocalCardForSync,
	RemoteCardRow,
	RemoteReviewLogRow,
} from "@features/integration/services/sync/card-mapper";
import {
	mapLocalCardToRemote,
	mapLocalReviewLogToRemote,
	mapRemoteCardToLocal,
	mapRemoteReviewLogToLocal,
} from "@features/integration/services/sync/card-mapper";
import {
	refreshCards,
	refreshMetadata,
} from "@shared/services/reactive-card-store";
import type { FirstSyncStatus, SyncOptions, SyncResult } from "@shared/types";
import type { SupabaseClient } from "@supabase/supabase-js";

interface SyncRpcResponse {
	status: "success" | "error";
	message?: string;
	time?: string;
}

export class SyncService {
	private authService: AuthService;
	private cardStore: SqliteStoreService;

	constructor(authService: AuthService, cardStore: SqliteStoreService) {
		this.authService = authService;
		this.cardStore = cardStore;
	}

	isAvailable(): boolean {
		return this.authService.isConfigured();
	}

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

			refreshMetadata();
			refreshCards();

			return { success: true, pulled, pushed };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error("[SyncService] Sync failed:", error);
			return { success: false, error: message, pulled: 0, pushed: 0 };
		}
	}

	private async pullAllTables(
		client: SupabaseClient,
		lastSync: number,
	): Promise<{
		cards: RemoteCardRow[];
		reviewLog: RemoteReviewLogRow[];
	}> {
		// Note: Supabase default limit is 1000 rows - we need explicit high limit
		const [cardsRes, reviewLogRes] = await Promise.all([
			client.from("cards").select("*").gt("updated_at", lastSync).limit(100000),
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
			throw new Error(`Pull review_log failed: ${reviewLogRes.error.message}`);

		return {
			cards: (cardsRes.data ?? []) as RemoteCardRow[],
			reviewLog: (reviewLogRes.data ?? []) as RemoteReviewLogRow[],
		};
	}

	/** Wrapped in a transaction for atomicity - if any upsert fails, all changes are rolled back. */
	private applyPulledData(data: {
		cards: RemoteCardRow[];
		reviewLog: RemoteReviewLogRow[];
	}): number {
		return this.cardStore.transaction(() => {
			let pulled = 0;

			// 1. Cards
			for (const remote of data.cards) {
				const local = this.cardStore.cards.get(remote.id) as
					| LocalCardForSync
					| undefined;
				const localUpdatedAt = local?.updatedAt ?? 0;
				if (!local || remote.updated_at > localUpdatedAt) {
					this.cardStore.cards.upsertFromRemote(mapRemoteCardToLocal(remote));
					pulled++;
				}
			}

			// 2. Review log (depends on cards)
			for (const remote of data.reviewLog) {
				const local = this.cardStore.stats.getReviewLogForSync(remote.id);
				if (!local || remote.updated_at > local.updatedAt) {
					this.cardStore.stats.upsertReviewLogFromRemote(
						mapRemoteReviewLogToLocal(remote),
					);
					pulled++;
				}
			}

			return pulled;
		});
	}

	private gatherLocalChanges(lastSync: number): {
		cards: LocalCardForSync[];
		reviewLog: ReviewLogForSync[];
	} {
		return {
			cards: this.cardStore.cards.getModifiedSince(lastSync),
			reviewLog: this.cardStore.stats.getModifiedReviewLogSince(lastSync),
		};
	}

	private async pushLocalChanges(
		client: SupabaseClient,
		localChanges: {
			cards: LocalCardForSync[];
			reviewLog: ReviewLogForSync[];
		},
	): Promise<number> {
		const { cards, reviewLog } = localChanges;

		const totalChanges = cards.length + reviewLog.length;

		if (totalChanges === 0) {
			return 0;
		}

		// Map to remote format (snake_case)
		const payload = {
			p_cards: cards.map((c) => mapLocalCardToRemote(c)),
			p_review_log: reviewLog.map((rl) => mapLocalReviewLogToRemote(rl)),
		};

		// Single atomic RPC call
		// Supabase client returns any for RPC data
		const { data, error } = await client.rpc("sync_all_data", payload);

		if (error) {
			throw new Error(`Push failed: ${error.message}`);
		}

		// Check response from RPC function (catches SQL-level errors)
		const response = data as SyncRpcResponse | null;
		if (response?.status === "error") {
			throw new Error(`Push RPC error: ${response.message ?? "Unknown error"}`);
		}

		// Validate response structure for successful case
		if (!response || typeof response !== "object") {
			console.error("[SyncService] Unexpected response from sync_all_data RPC");
		}

		return totalChanges;
	}

	getLastSyncTimestamp(): number {
		const value = this.cardStore.cards.getSyncMetadata("last_sync_timestamp");
		return value ? parseInt(value, 10) : 0;
	}

	private setLastSyncTimestamp(timestamp: number): void {
		this.cardStore.cards.setSyncMetadata(
			"last_sync_timestamp",
			String(timestamp),
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
				p_cards: allLocalData.cards.map((c) => mapLocalCardToRemote(c)),
				p_review_log: allLocalData.reviewLog.map((rl) =>
					mapLocalReviewLogToRemote(rl),
				),
			};

			// Call replace RPC (deletes all user data, then inserts fresh)
			// Supabase client returns any for RPC data
			const { data, error } = await client.rpc("replace_all_data", payload);

			if (error) {
				throw new Error(`Force replace failed: ${error.message}`);
			}

			// Check response from RPC function (catches SQL-level errors)
			const response = data as SyncRpcResponse | null;
			if (response?.status === "error") {
				throw new Error(
					`Force replace RPC error: ${response.message ?? "Unknown error"}`,
				);
			}

			// Update sync timestamp
			const now = Date.now();
			this.setLastSyncTimestamp(now);

			refreshMetadata();
			refreshCards();

			const totalPushed =
				allLocalData.cards.length + allLocalData.reviewLog.length;

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
				this.cardStore.cards.upsertFromRemote(mapRemoteCardToLocal(remote));
				pulled++;
			}

			// Review log (depends on cards)
			for (const remote of pullResults.reviewLog) {
				this.cardStore.stats.upsertReviewLogFromRemote(
					mapRemoteReviewLogToLocal(remote),
				);
				pulled++;
			}

			// 4. Rebuild daily stats from synced review_log
			this.cardStore.stats.rebuildDailyStatsFromReviewLog();

			// 5. Update sync timestamp
			const now = Date.now();
			this.setLastSyncTimestamp(now);

			refreshMetadata();
			refreshCards();

			return { success: true, pulled, pushed: 0 };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error("[SyncService] Force pull failed:", error);
			return { success: false, error: message, pulled: 0, pushed: 0 };
		}
	}

	private deleteAllLocalData(): void {
		// Order matters - delete dependent tables first
		this.cardStore.stats.deleteAllReviewLogForSync();
		this.cardStore.cards.deleteAllForSync();
	}
}
