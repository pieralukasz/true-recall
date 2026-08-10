import type { CardSchedulingMeta } from "../../types";
import type { FSRSSettings, RModeSettings } from "../../types/settings.types";
import type { FSRSService } from "../fsrs/fsrs.service";

/**
 * R-Mode selection parameters.
 *
 * R-Mode replaces the due-date queue with a continuous ranking by
 * retrievability. Nothing is ever "late" — a card is either worth reviewing
 * right now or it is not.
 */
export interface RModeQueueOptions {
	/** Number of Review-state cards requested by the user. */
	targetCount: number;
	/** Share of the session filled from the comfort band. Clamped to 0–0.5. */
	comfortMix: number;
	/** Above this R a review buys almost no stability, so the card is skipped. */
	ceiling: number;
	/** Boundary between "losing it" and "know it". Normally requestRetention. */
	comfortFloor: number;
	/** Below this R a card can never be displaced by the comfort quota. */
	urgentBelow: number;
	/**
	 * Optional per-card preset policy. A project or global session can contain
	 * cards governed by different FSRS weights and retention targets.
	 */
	resolveCardOptions?: (card: CardSchedulingMeta) => RModeCardOptions;
}

export interface RModeCardOptions {
	ceiling: number;
	comfortFloor: number;
	presetSettings?: FSRSSettings;
}

export interface RModeCardScore extends RModeCardOptions {
	r: number;
}

export interface RModeQueueResult {
	cards: CardSchedulingMeta[];
	/** Cards below the ceiling — everything a session could possibly draw from. */
	poolSize: number;
	/** Pool was smaller than the request: there is nothing else worth doing. */
	poolExhausted: boolean;
}

interface ScoredCard {
	card: CardSchedulingMeta;
	r: number;
	comfortFloor: number;
}

const MAX_COMFORT_MIX = 0.5;
const WARMUP_CARDS = 2;
const MAX_CONSECUTIVE_HARD = 3;

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function byRetrievabilityAsc(a: ScoredCard, b: ScoredCard): number {
	if (a.r !== b.r) return a.r - b.r;
	return a.card.id.localeCompare(b.card.id);
}

export function scoreRModeCard(
	card: CardSchedulingMeta,
	fsrsService: FSRSService,
	options: Pick<
		RModeQueueOptions,
		"ceiling" | "comfortFloor" | "resolveCardOptions"
	>,
	now: Date = new Date(),
): RModeCardScore {
	const resolved = options.resolveCardOptions?.(card) ?? {
		ceiling: options.ceiling,
		comfortFloor: options.comfortFloor,
	};
	return {
		...resolved,
		r: fsrsService.getRetrievability(card.fsrs, now, resolved.presetSettings),
	};
}

/**
 * Pick `count` cards spread across the whole comfort band rather than taking
 * the `count` easiest. Sorting here would surface the same handful of cards
 * every session; stratified sampling keeps the band rotating.
 */
function sampleSpread(sorted: ScoredCard[], count: number): ScoredCard[] {
	if (count <= 0) return [];
	if (count >= sorted.length) return [...sorted];

	const picked: ScoredCard[] = [];
	const bucketSize = sorted.length / count;
	for (let i = 0; i < count; i++) {
		const start = Math.floor(i * bucketSize);
		const end = Math.min(sorted.length, Math.floor((i + 1) * bucketSize));
		const offset = Math.floor(Math.random() * Math.max(1, end - start));
		const entry = sorted[Math.min(sorted.length - 1, start + offset)];
		if (entry) picked.push(entry);
	}
	return picked;
}

/**
 * Warm up on cards the user knows, then interleave so a run of near-forgotten
 * cards never exceeds MAX_CONSECUTIVE_HARD. A session that opens with a wall of
 * failures is the one the user stops coming back to.
 */
function arrange(hard: ScoredCard[], comfort: ScoredCard[]): ScoredCard[] {
	const hardQueue = [...hard];
	const comfortQueue = [...comfort];
	const result: ScoredCard[] = [];

	// Warm up on the best-remembered cards available, taken from the top of the
	// comfort band rather than its borderline end.
	for (let i = 0; i < WARMUP_CARDS && comfortQueue.length > 0; i++) {
		const entry = comfortQueue.pop();
		if (entry) result.push(entry);
	}

	let consecutiveHard = 0;
	while (hardQueue.length > 0 || comfortQueue.length > 0) {
		const takeComfort =
			hardQueue.length === 0 ||
			(consecutiveHard >= MAX_CONSECUTIVE_HARD && comfortQueue.length > 0);
		const entry = takeComfort ? comfortQueue.shift() : hardQueue.shift();
		if (!entry) break;

		consecutiveHard = takeComfort ? 0 : consecutiveHard + 1;
		result.push(entry);
	}

	return result;
}

/**
 * Build a session from continuous retrievability instead of due dates.
 *
 * Only review-state cards belong here. New cards keep their existing path;
 * learning and relearning steps remain ordered by their short due times.
 */
export function buildRetrievabilityQueue(
	reviewCards: CardSchedulingMeta[],
	fsrsService: FSRSService,
	options: RModeQueueOptions,
	now: Date = new Date(),
): RModeQueueResult {
	const pool: ScoredCard[] = [];
	for (const card of reviewCards) {
		const score = scoreRModeCard(card, fsrsService, options, now);
		if (score.r <= score.ceiling) {
			pool.push({ card, r: score.r, comfortFloor: score.comfortFloor });
		}
	}

	if (pool.length === 0) {
		return { cards: [], poolSize: 0, poolExhausted: true };
	}

	const target = clamp(Math.floor(options.targetCount), 0, pool.length);
	if (target === 0) {
		return { cards: [], poolSize: pool.length, poolExhausted: false };
	}

	const hard: ScoredCard[] = [];
	const comfort: ScoredCard[] = [];
	let urgentCount = 0;
	for (const entry of pool) {
		if (entry.r < entry.comfortFloor) {
			hard.push(entry);
			if (entry.r < options.urgentBelow) urgentCount++;
		} else {
			comfort.push(entry);
		}
	}
	hard.sort(byRetrievabilityAsc);
	comfort.sort(byRetrievabilityAsc);

	// Urgent cards claim their slots before the comfort quota is honoured.
	const comfortCeiling = Math.max(0, target - Math.min(urgentCount, target));
	const comfortQuota = Math.min(
		Math.round(target * clamp(options.comfortMix, 0, MAX_COMFORT_MIX)),
		comfort.length,
		comfortCeiling,
	);

	const pickedHard = hard.slice(0, target - comfortQuota);
	const pickedComfort = sampleSpread(comfort, comfortQuota);

	// Whichever band ran short, top up from the other one.
	const shortfall = target - pickedHard.length - pickedComfort.length;
	if (shortfall > 0) {
		const usedIds = new Set(
			[...pickedHard, ...pickedComfort].map((entry) => entry.card.id),
		);
		for (const entry of [...hard, ...comfort]) {
			if (pickedHard.length + pickedComfort.length >= target) break;
			if (usedIds.has(entry.card.id)) continue;
			(entry.r < entry.comfortFloor ? pickedHard : pickedComfort).push(entry);
			usedIds.add(entry.card.id);
		}
	}
	// Top-ups append from the low edge and can disturb the sampled order. Keep
	// both bands sorted so `arrange` can reliably take the strongest warm-up
	// cards from the end of the comfort band.
	pickedHard.sort(byRetrievabilityAsc);
	pickedComfort.sort(byRetrievabilityAsc);

	return {
		cards: arrange(pickedHard, pickedComfort).map((entry) => entry.card),
		poolSize: pool.length,
		poolExhausted: pool.length <= target,
	};
}

/** Cards worth reviewing right now — the number behind "nothing left to do". */
export function countRModePool(
	reviewCards: CardSchedulingMeta[],
	fsrsService: FSRSService,
	ceiling: number,
	now: Date = new Date(),
): number {
	let count = 0;
	for (const card of reviewCards) {
		if (fsrsService.getRetrievability(card.fsrs, now) <= ceiling) count++;
	}
	return count;
}

/**
 * Translate stored settings into selection parameters.
 *
 * Returns undefined when R-Mode is off or no session size was requested, which
 * is what keeps the due-date queue as the default path.
 */
export function resolveRModeOptions(
	rMode: RModeSettings | undefined,
	requestRetention: number,
	targetCount: number | undefined,
): RModeQueueOptions | undefined {
	// Settings saved before R-Mode existed have no rMode block at all.
	// Only the mode being off may fall back to the due queue: a session started
	// from an entry point that states no size (a command, a context menu) still
	// has to be an R-Mode session, or the mode leaks back into due dates.
	if (!rMode?.enabled) return undefined;

	// Stating no size and stating zero are different requests: the first means
	// "you decide", the second means "no reviews, just new and learning cards".
	return {
		targetCount:
			targetCount === undefined
				? Math.max(1, rMode.defaultSessionSize)
				: Math.max(0, targetCount),
		comfortMix: rMode.comfortMix,
		ceiling: Math.min(0.999, requestRetention + rMode.ceilingOffset),
		comfortFloor: requestRetention,
		urgentBelow: rMode.urgentBelow,
	};
}

/**
 * How a set of cards is distributed across retrievability bands.
 *
 * A single average hides a dying deck behind a healthy one, so the panel shows
 * the spread and treats the mean as a headline, not as the whole story.
 */
export interface RetrievabilitySummary {
	/** R below urgentBelow — actively being lost. */
	urgent: number;
	/** Between urgentBelow and comfortFloor — slipping. */
	losing: number;
	/** Between comfortFloor and ceiling — known, still worth a look. */
	known: number;
	/** Above the ceiling — nothing to gain right now. */
	fresh: number;
	/** Review-state cards considered. */
	total: number;
	/** urgent + losing + known: everything a session could draw from. */
	pool: number;
	/** Mean R across review-state cards, or null when there are none. */
	averageR: number | null;
	/** Sum retained so parent scopes can aggregate without averaging averages. */
	sumR: number;
}

export function summarizeRetrievability(
	reviewCards: CardSchedulingMeta[],
	fsrsService: FSRSService,
	options: Pick<
		RModeQueueOptions,
		"ceiling" | "comfortFloor" | "urgentBelow" | "resolveCardOptions"
	>,
	now: Date = new Date(),
): RetrievabilitySummary {
	let urgent = 0;
	let losing = 0;
	let known = 0;
	let fresh = 0;
	let sum = 0;

	for (const card of reviewCards) {
		const score = scoreRModeCard(card, fsrsService, options, now);
		const { r } = score;
		sum += r;
		if (r > score.ceiling) fresh++;
		else if (r >= score.comfortFloor) known++;
		else if (r >= options.urgentBelow) losing++;
		else urgent++;
	}

	const total = reviewCards.length;
	return {
		urgent,
		losing,
		known,
		fresh,
		total,
		pool: urgent + losing + known,
		averageR: total > 0 ? sum / total : null,
		sumR: sum,
	};
}
