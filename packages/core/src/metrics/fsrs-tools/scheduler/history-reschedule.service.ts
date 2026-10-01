/**
 * History Reschedule Service
 *
 * Recomputes every Review card's FSRS memory state (stability, difficulty)
 * from its full review history with the *current* preset weights, then picks
 * a new due date. This is what makes new weights take effect today instead of
 * one review at a time: RescheduleService only re-derives the interval from
 * the stored stability, which the old weights produced.
 *
 * Due policy:
 * - "postpone-only" (default): a card is never pulled earlier than it is
 *   already scheduled. Cards the new model thinks are overdue keep their date;
 *   cards it trusts more move later.
 * - "full": every card gets exactly the due date the new model computes
 *   (dates in the past become "due today").
 *
 * Cards whose history does not start with a New-state review (imported cards,
 * histories without their first answers) cannot be replayed from zero. They
 * keep their stored memory state and only get a new interval from it under
 * the current retention and weights ("stored-state").
 *
 * The preset's first-interval cap is not applied: applied retroactively it
 * would pull long-graduated cards to "due today".
 */

import { FSRS, State } from "ts-fsrs";

import { DEFAULT_FSRS_WEIGHTS, MS_PER_DAY } from "../../../constants";
import type { SqliteStoreService } from "../../../persistence/sqlite/SqliteStoreService";
import type { FSRSService } from "../../../services/fsrs/fsrs.service";
import type { FSRSCardData } from "../../../types";
import type { FSRSSettings } from "../../../types/settings.types";

export type HistoryRescheduleMode = "postpone-only" | "full";

export type HistoryRescheduleCard = FSRSCardData & {
	sourceUid?: string | null;
};

export interface HistoryRescheduleLog {
	id: string;
	cardId: string;
	reviewedAt: string;
	rating: number;
	state: number;
	presetName?: string | null;
	deviceId: string | null;
	reviewKind: string | null;
	deletedAt: number | null;
}

/**
 * Settings for one card. `lastPresetName` is the preset its latest review
 * was scheduled with, so cards studied under a project preset keep it.
 */
export type HistoryRescheduleSettingsResolver = (
	card: HistoryRescheduleCard,
	lastPresetName: string | null,
) => FSRSSettings;

export interface HistoryRescheduleChange {
	cardId: string;
	/** Full scheduling state before the change (used for undo) */
	before: FSRSCardData;
	after: FSRSCardData;
	/** Due the new model alone would choose, before the due policy */
	modelDue: string;
	source: "replay" | "stored-state";
}

export interface HistoryRescheduleSummary {
	mode: HistoryRescheduleMode;
	reviewCards: number;
	rescheduled: number;
	/** Cards without a full history: interval recomputed from stored state */
	fromStoredState: number;
	skipped: { noUsableState: number; notReviewAfterReplay: number };
	movedLater: number;
	movedEarlier: number;
	keptDate: number;
	/** Review cards due before the next day boundary, before and after */
	dueToday: { before: number; after: number };
	/** Average Review cards per day over the next 30 days (after today) */
	avgNext30Days: { before: number; after: number };
	/** Same counts restricted to cards outside `countExcludedSourceUids` */
	visible?: {
		dueToday: { before: number; after: number };
		avgNext30Days: { before: number; after: number };
	};
	meanStability: { before: number; after: number };
}

export interface HistoryRescheduleResult {
	summary: HistoryRescheduleSummary;
	changes: HistoryRescheduleChange[];
	/** Planned changes not written because the card changed meanwhile */
	staleSkipped: number;
}

export interface HistoryRescheduleOptions {
	mode?: HistoryRescheduleMode;
	/** Start of tomorrow in the user's day-start-hour sense */
	tomorrowBoundary: Date;
	/** Current time for stored-state intervals (default: now) */
	now?: Date;
	/** Cards whose counts go into summary.visible are those NOT in this set */
	countExcludedSourceUids?: Set<string>;
	/**
	 * Awaited every `yieldEvery` cards so a long replay does not freeze the
	 * UI thread (the plugin passes a setTimeout(0)).
	 */
	yieldControl?: () => Promise<void>;
	yieldEvery?: number;
}

const DEFAULT_YIELD_EVERY = 500;

/** Same filter and total order as sync replay: time, device, id */
function orderLogs(logs: HistoryRescheduleLog[]): HistoryRescheduleLog[] {
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

/** True when the stored card still has the scheduling state `expected` had */
export function sameSchedulingState(
	current: FSRSCardData | undefined,
	expected: FSRSCardData,
): boolean {
	return (
		current !== undefined &&
		current.due === expected.due &&
		current.lastReview === expected.lastReview &&
		current.state === expected.state &&
		current.reps === expected.reps
	);
}

function round1(n: number): number {
	return Math.round(n * 10) / 10;
}

export class HistoryRescheduleService {
	private readonly intervalFsrsCache = new Map<string, FSRS>();

	constructor(private fsrsService: FSRSService) {}

	/**
	 * Plan against the live store and, unless `dryRun`, write the new memory
	 * state and due dates in one transaction. Review logs are not touched.
	 * A card answered while the plan was computed is left alone.
	 */
	async run(
		store: SqliteStoreService,
		resolveSettings: HistoryRescheduleSettingsResolver,
		options: HistoryRescheduleOptions & { dryRun?: boolean },
	): Promise<HistoryRescheduleResult> {
		const cards: HistoryRescheduleCard[] = store.cards.getAll();
		const logsByCard = new Map<string, HistoryRescheduleLog[]>();
		for (const log of store.stats.getAllReplayLogs()) {
			const list = logsByCard.get(log.cardId);
			if (list) list.push(log);
			else logsByCard.set(log.cardId, [log]);
		}
		const result = await this.plan(cards, logsByCard, resolveSettings, options);
		if (options.dryRun !== false || result.changes.length === 0) {
			return result;
		}

		const written: HistoryRescheduleChange[] = [];
		store.transaction(() => {
			for (const change of result.changes) {
				if (
					!sameSchedulingState(store.cards.get(change.cardId), change.before)
				) {
					continue;
				}
				store.cards.applyReplayedScheduling(change.cardId, change.after);
				written.push(change);
			}
		});
		return {
			...result,
			changes: written,
			staleSkipped: result.changes.length - written.length,
		};
	}

	async plan(
		cards: HistoryRescheduleCard[],
		logsByCard: Map<string, HistoryRescheduleLog[]>,
		resolveSettings: HistoryRescheduleSettingsResolver,
		options: HistoryRescheduleOptions,
	): Promise<HistoryRescheduleResult> {
		const mode = options.mode ?? "postpone-only";
		const nowMs = (options.now ?? new Date()).getTime();
		const tomorrow = options.tomorrowBoundary.getTime();
		const horizonEnd = tomorrow + 30 * MS_PER_DAY;
		const excluded = options.countExcludedSourceUids;
		const yieldEvery = options.yieldEvery ?? DEFAULT_YIELD_EVERY;

		const changes: HistoryRescheduleChange[] = [];
		const skipped = { noUsableState: 0, notReviewAfterReplay: 0 };
		let fromStoredState = 0;
		let reviewCards = 0;
		let movedLater = 0;
		let movedEarlier = 0;
		let keptDate = 0;
		let sumBeforeS = 0;
		let sumAfterS = 0;
		const counts = {
			todayBefore: 0,
			todayAfter: 0,
			nextBefore: 0,
			nextAfter: 0,
			vTodayBefore: 0,
			vTodayAfter: 0,
			vNextBefore: 0,
			vNextAfter: 0,
		};
		const tally = (
			dueMs: number,
			which: "Before" | "After",
			visible: boolean,
		) => {
			if (dueMs < tomorrow) {
				counts[`today${which}`]++;
				if (visible) counts[`vToday${which}`]++;
			} else if (dueMs < horizonEnd) {
				counts[`next${which}`]++;
				if (visible) counts[`vNext${which}`]++;
			}
		};

		let processed = 0;
		for (const card of cards) {
			if (card.state !== State.Review || card.suspended) continue;
			if (options.yieldControl && ++processed % yieldEvery === 0) {
				await options.yieldControl();
			}
			reviewCards++;
			const visible = !(card.sourceUid && excluded?.has(card.sourceUid));
			const storedDueMs = new Date(card.due).getTime();
			tally(storedDueMs, "Before", visible);
			sumBeforeS += card.stability;

			const ordered = orderLogs(logsByCard.get(card.id) ?? []);
			const lastPresetName = ordered.at(-1)?.presetName ?? null;
			const settings: FSRSSettings = {
				...resolveSettings(card, lastPresetName),
				firstIntervalMax: null,
			};
			const fromScratch = ordered[0]?.state === State.New;

			let next: FSRSCardData | null;
			if (fromScratch) {
				next = this.replay(card.id, ordered, settings);
				if (!next) skipped.notReviewAfterReplay++;
			} else {
				next = this.fromStoredState(card, settings, nowMs);
				if (!next) skipped.noUsableState++;
			}
			if (!next) {
				tally(storedDueMs, "After", visible);
				sumAfterS += card.stability;
				continue;
			}
			if (!fromScratch) fromStoredState++;

			const modelDueMs = new Date(next.due).getTime();
			const finalDueMs =
				mode === "postpone-only" && modelDueMs < storedDueMs
					? storedDueMs
					: modelDueMs;

			if (finalDueMs > storedDueMs + MS_PER_DAY) movedLater++;
			else if (finalDueMs < storedDueMs - MS_PER_DAY) movedEarlier++;
			else keptDate++;

			const lastReviewMs = next.lastReview
				? new Date(next.lastReview).getTime()
				: finalDueMs;
			const { sourceUid: _sourceUid, ...before } = card;
			changes.push({
				cardId: card.id,
				before,
				after: {
					...next,
					due: new Date(finalDueMs).toISOString(),
					scheduledDays: Math.max(
						1,
						Math.round((finalDueMs - lastReviewMs) / MS_PER_DAY),
					),
				},
				modelDue: next.due,
				source: fromScratch ? "replay" : "stored-state",
			});
			tally(finalDueMs, "After", visible);
			sumAfterS += next.stability;
		}

		const avg = (n: number) => Math.round(n / 30);
		const summary: HistoryRescheduleSummary = {
			mode,
			reviewCards,
			rescheduled: changes.length,
			fromStoredState,
			skipped,
			movedLater,
			movedEarlier,
			keptDate,
			dueToday: { before: counts.todayBefore, after: counts.todayAfter },
			avgNext30Days: {
				before: avg(counts.nextBefore),
				after: avg(counts.nextAfter),
			},
			meanStability: {
				before: reviewCards ? round1(sumBeforeS / reviewCards) : 0,
				after: reviewCards ? round1(sumAfterS / reviewCards) : 0,
			},
		};
		if (excluded) {
			summary.visible = {
				dueToday: { before: counts.vTodayBefore, after: counts.vTodayAfter },
				avgNext30Days: {
					before: avg(counts.vNextBefore),
					after: avg(counts.vNextAfter),
				},
			};
		}
		return { summary, changes, staleSkipped: 0 };
	}

	private replay(
		cardId: string,
		ordered: HistoryRescheduleLog[],
		settings: FSRSSettings,
	): FSRSCardData | null {
		let card = this.fsrsService.createNewCard(cardId);
		for (const log of ordered) {
			card = this.fsrsService.scheduleCard(
				card,
				log.rating as 1 | 2 | 3 | 4,
				new Date(log.reviewedAt),
				settings,
			);
		}
		return card.state === State.Review ? card : null;
	}

	/**
	 * No full history: keep stability and difficulty, recompute only the
	 * interval under the current retention and weights.
	 */
	private fromStoredState(
		card: HistoryRescheduleCard,
		settings: FSRSSettings,
		nowMs: number,
	): FSRSCardData | null {
		if (!card.lastReview || !(card.stability > 0)) return null;
		const lastReviewMs = new Date(card.lastReview).getTime();
		if (!Number.isFinite(lastReviewMs)) return null;
		const elapsed = Math.max(
			0,
			Math.floor((nowMs - lastReviewMs) / MS_PER_DAY),
		);
		const interval = this.intervalFsrs(settings).next_interval(
			card.stability,
			elapsed,
		);
		return {
			...card,
			due: new Date(lastReviewMs + interval * MS_PER_DAY).toISOString(),
			scheduledDays: interval,
		};
	}

	private intervalFsrs(settings: FSRSSettings): FSRS {
		const weights = settings.weights ?? DEFAULT_FSRS_WEIGHTS;
		const key = `${settings.requestRetention}|${settings.maximumInterval}|${weights.join(",")}`;
		let fsrs = this.intervalFsrsCache.get(key);
		if (!fsrs) {
			fsrs = new FSRS({
				request_retention: settings.requestRetention,
				maximum_interval: settings.maximumInterval,
				w: weights,
				enable_fuzz: false,
			});
			this.intervalFsrsCache.set(key, fsrs);
		}
		return fsrs;
	}
}
