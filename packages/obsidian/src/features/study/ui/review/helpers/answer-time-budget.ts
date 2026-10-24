/**
 * Suggested time to answer one card.
 *
 * Two inputs, both already available in the review session:
 * - answer length: reading a long answer back costs time, worth up to +75%;
 * - difficulty: FSRS's learned summary of the Again/Hard/Good/Easy history
 *   (1 = trivial, 10 = hard), worth -20% … +50%. Cards the user keeps failing
 *   get more room, cards they know well get less.
 *
 * The product is clamped so a pathological card never suggests more than
 * 2.5x the base time, and the result never drops below MIN_SECONDS.
 */

export interface AnswerTimeCard {
	answer: string;
	/** Only these two scheduling fields matter; new cards have no history. */
	fsrs: { reps?: number; difficulty?: number };
}

/** Answer length that counts as one "chunk" of extra reading time. */
const CHARS_PER_CHUNK = 40;

/** FSRS difficulty is 1..10; 5.5 is the neutral middle. */
const HISTORY_DIFFICULTY_SPAN = 9;
/** Easy cards shorten the budget, but never below this. */
const HISTORY_PENALTY = 0.2;

const DEFAULT_SECONDS_PER_CHUNK = 3;
const DEFAULT_HISTORY_WEIGHT = 50;

/** Safety net: no card should ever suggest more than this. */
const MAX_ANSWER_SECONDS = 600;

export interface AnswerTimeWeights {
	/** Extra seconds per 40 characters of answer. 0 ignores length. */
	secondsPerChunk?: number;
	/** Maximum difficulty bonus, in percent. 0 ignores rating history. */
	historyWeight?: number;
}


export const MIN_ANSWER_SECONDS = 5;
export const DEFAULT_ANSWER_SECONDS = 20;

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

/** Characters the reader actually sees: tags and line-break noise dropped. */
export function visibleAnswerLength(answer: string): number {
	return answer.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().length;
}

export function suggestedAnswerSeconds(
	card: AnswerTimeCard,
	baseSeconds: number,
	weights: AnswerTimeWeights = {},
): number {
	const base = Math.max(MIN_ANSWER_SECONDS, Math.round(baseSeconds));
	const secondsPerChunk = Math.max(
		0,
		weights.secondsPerChunk ?? DEFAULT_SECONDS_PER_CHUNK,
	);
	const historyWeight =
		Math.max(0, weights.historyWeight ?? DEFAULT_HISTORY_WEIGHT) / 100;

	// The base time covers a short answer; every 40 characters of answer adds
	// its own reading time on top, so the budget grows linearly with length.
	const lengthSeconds =
		(visibleAnswerLength(card.answer ?? "") / CHARS_PER_CHUNK) *
		secondsPerChunk;

	const reps = card.fsrs?.reps ?? 0;
	const difficulty = card.fsrs?.difficulty ?? 0;
	const historyFactor =
		reps > 0 && historyWeight > 0
			? 1 +
				clamp(
					(difficulty - 5.5) / HISTORY_DIFFICULTY_SPAN,
					-HISTORY_PENALTY,
					historyWeight,
				)
			: 1;

	const total = (base + lengthSeconds) * historyFactor;
	return Math.max(
		MIN_ANSWER_SECONDS,
		Math.round(Math.min(total, MAX_ANSWER_SECONDS)),
	);
}
