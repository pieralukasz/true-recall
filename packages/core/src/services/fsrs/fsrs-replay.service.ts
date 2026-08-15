/**
 * FSRS Replay Service
 *
 * Rebuilds a card's scheduling state deterministically from its merged
 * review history. Used by device sync when the same card was reviewed on
 * more than one device between merges: instead of last-write-wins on the
 * card row (which would discard one device's review), both review events
 * are kept and the state is recomputed from the union.
 *
 * Determinism: the log ordering is a total order (reviewedAt, deviceId, id),
 * settings resolution is pure, and FSRSService seeds interval fuzz with the
 * card id, so every device converges to an identical state from the same
 * merged log set.
 */

import type { Grade } from "ts-fsrs";

import type { FSRSCardData } from "../../types";
import type { FSRSSettings } from "../../types/settings.types";
import type { FSRSService } from "./fsrs.service";

export interface ReplayLogEntry {
	id: string;
	reviewedAt: string;
	rating: number;
	presetName: string | null;
	deviceId: string | null;
	reviewKind: string | null;
	deletedAt: number | null;
}

export type PresetSettingsResolver = (
	presetName: string | null,
) => FSRSSettings;

/**
 * Filter out non-scheduling entries (previews, tombstones, manual ratings)
 * and impose the deterministic total order used for replay.
 */
export function orderReplayLogs(logs: ReplayLogEntry[]): ReplayLogEntry[] {
	return logs
		.filter(
			(log) =>
				log.deletedAt == null &&
				log.reviewKind !== "preview" &&
				log.rating >= 1 &&
				log.rating <= 4,
		)
		.sort(
			(a, b) =>
				new Date(a.reviewedAt).getTime() - new Date(b.reviewedAt).getTime() ||
				(a.deviceId ?? "").localeCompare(b.deviceId ?? "") ||
				a.id.localeCompare(b.id),
		);
}

export class FsrsReplayService {
	constructor(
		private fsrsService: FSRSService,
		private resolveSettings: PresetSettingsResolver,
	) {}

	/**
	 * Replay the card's full review history from an empty card.
	 * Returns null when no schedulable reviews remain after filtering.
	 */
	replayCard(cardId: string, logs: ReplayLogEntry[]): FSRSCardData | null {
		const ordered = orderReplayLogs(logs);
		if (ordered.length === 0) return null;

		let card = this.fsrsService.createNewCard(cardId);
		for (const log of ordered) {
			card = this.fsrsService.scheduleCard(
				card,
				log.rating as Grade,
				new Date(log.reviewedAt),
				this.resolveSettings(log.presetName),
			);
		}
		return card;
	}
}
