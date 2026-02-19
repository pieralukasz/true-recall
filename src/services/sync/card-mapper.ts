import type { FSRSCardData } from "../../types";
import type { ReviewLogForSync } from "../persistence/sqlite/modules/StatsActions";

export interface RemoteCardRow {
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
	card_type: string;
	cloze_template: string | null;
	cloze_index: number | null;
	reverse_of: string | null;
}

export interface RemoteReviewLogRow {
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
	preset_name: string | null;
}

export interface LocalCardForSync extends FSRSCardData {
	updatedAt?: number;
	deletedAt?: number | null;
}

export function mapRemoteCardToLocal(remote: RemoteCardRow): LocalCardForSync {
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
		cardType: (remote.card_type as import("../../types").CardType) ?? "basic",
		clozeTemplate: remote.cloze_template ?? undefined,
		clozeIndex: remote.cloze_index ?? undefined,
		reverseOf: remote.reverse_of ?? undefined,
	};
}

export function mapRemoteReviewLogToLocal(
	remote: RemoteReviewLogRow,
): ReviewLogForSync {
	// Convert bigint timestamp back to ISO string with validation
	let reviewedAt: string;
	const MIN_VALID_TIMESTAMP = 946684800000; // Year 2000

	if (typeof remote.reviewed_at === "number") {
		if (remote.reviewed_at < MIN_VALID_TIMESTAMP) {
			throw new Error(`Invalid reviewed_at timestamp: ${remote.reviewed_at}`);
		}
		reviewedAt = new Date(remote.reviewed_at).toISOString();
	} else if (typeof remote.reviewed_at === "string") {
		// Handle numeric string (e.g., "1769021590000" from Supabase)
		if (/^\d{13,}$/.test(remote.reviewed_at)) {
			const ts = parseInt(remote.reviewed_at, 10);
			if (ts < MIN_VALID_TIMESTAMP) {
				throw new Error(`Invalid reviewed_at timestamp: ${ts}`);
			}
			reviewedAt = new Date(ts).toISOString();
		} else {
			reviewedAt = remote.reviewed_at;
		}
	} else {
		throw new Error(`Invalid reviewed_at type: ${typeof remote.reviewed_at}`);
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
		presetName: remote.preset_name ?? null,
	};
}

export function mapLocalCardToRemote(
	local: LocalCardForSync,
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
		card_type: local.cardType ?? "basic",
		cloze_template: local.clozeTemplate ?? null,
		cloze_index: local.clozeIndex ?? null,
		reverse_of: local.reverseOf ?? null,
	};
}

export function mapLocalReviewLogToRemote(
	local: ReviewLogForSync,
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
		preset_name: local.presetName ?? null,
	};
}
