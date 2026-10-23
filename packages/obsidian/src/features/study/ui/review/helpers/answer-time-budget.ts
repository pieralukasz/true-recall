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

/** Answer length that already earns the full length bonus. */
const LENGTH_BONUS_CHARS = 400;
const LENGTH_BONUS_MAX = 0.75;

/** FSRS difficulty is 1..10; 5.5 is the neutral middle. */
const HISTORY_DIFFICULTY_SPAN = 9;
const HISTORY_FLOOR = -0.2;
const HISTORY_CEILING = 0.5;

const MAX_FACTOR = 2.5;

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
): number {
	const base = Math.max(MIN_ANSWER_SECONDS, Math.round(baseSeconds));
	const lengthFactor =
		1 +
		Math.min(
			visibleAnswerLength(card.answer ?? "") / LENGTH_BONUS_CHARS,
			LENGTH_BONUS_MAX,
		);

	const reps = card.fsrs?.reps ?? 0;
	const difficulty = card.fsrs?.difficulty ?? 0;
	const historyFactor =
		reps > 0
			? 1 +
				clamp(
					(difficulty - 5.5) / HISTORY_DIFFICULTY_SPAN,
					HISTORY_FLOOR,
					HISTORY_CEILING,
				)
			: 1;

	const factor = Math.min(lengthFactor * historyFactor, MAX_FACTOR);
	return Math.max(MIN_ANSWER_SECONDS, Math.round(base * factor));
}
