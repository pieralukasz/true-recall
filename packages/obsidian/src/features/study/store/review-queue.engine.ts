import { State } from "ts-fsrs";

import { LEARN_AHEAD_LIMIT_MINUTES } from "@true-recall/core/constants";
import type { FSRSFlashcardItem } from "@true-recall/core/types";

import type { BadgeCounts } from "@true-recall/obsidian/store/types";

/**
 * Pure queue math for the review session.
 *
 * The slice owns zustand plumbing; every queue transition lives here as a
 * pure function over an immutable snapshot. Central invariant, enforced by
 * `promoteActionableCard` at every mutation point: whenever an actionable
 * card exists at or after the cursor, the cursor card is actionable — so
 * the waiting screen can only appear when nothing is left to review now.
 */
export interface QueueSnapshot {
	queue: FSRSFlashcardItem[];
	currentIndex: number;
}

export interface AnswerAdvanceResult extends QueueSnapshot {
	/** Where the requeued copy actually landed after promotion (undo bookkeeping). */
	requeuePosition: number | undefined;
}

export function isLearningCard(card: FSRSFlashcardItem): boolean {
	return (
		card.fsrs.state === State.Learning || card.fsrs.state === State.Relearning
	);
}

/**
 * Learning cards become actionable only at their exact due time; other
 * states get the learn-ahead window (matches Anki semantics — the waiting
 * screen itself is the learn-ahead fallback for learning cards).
 */
export function isCardDueNow(
	card: FSRSFlashcardItem,
	now: Date = new Date(),
): boolean {
	const dueDate = new Date(card.fsrs.due);
	if (isLearningCard(card)) {
		return dueDate <= now;
	}
	const learnAheadTime = new Date(
		now.getTime() + LEARN_AHEAD_LIMIT_MINUTES * 60 * 1000,
	);
	return dueDate <= learnAheadTime;
}

/** A learning card that is queued but cannot be reviewed yet. */
export function isPendingLearning(
	card: FSRSFlashcardItem,
	now: Date = new Date(),
): boolean {
	return isLearningCard(card) && !isCardDueNow(card, now);
}

export function countBadges(
	queue: FSRSFlashcardItem[],
	fromIndex: number,
): BadgeCounts {
	const counts: BadgeCounts = { new: 0, learning: 0, due: 0 };
	for (let i = fromIndex; i < queue.length; i++) {
		const card = queue[i];
		if (!card) continue;
		if (card.fsrs.state === State.New) counts.new++;
		else if (isLearningCard(card)) counts.learning++;
		else counts.due++;
	}
	return counts;
}

/**
 * If the cursor card is a pending learning card, swap it with the first
 * actionable card later in the queue. Returns the same snapshot when no
 * swap is needed or possible.
 */
export function promoteActionableCard(
	snapshot: QueueSnapshot,
	now: Date = new Date(),
): QueueSnapshot & { swappedWith: number | null } {
	const { queue, currentIndex } = snapshot;
	const cursorCard = queue[currentIndex];
	if (!cursorCard || !isPendingLearning(cursorCard, now)) {
		return { ...snapshot, swappedWith: null };
	}

	for (let i = currentIndex + 1; i < queue.length; i++) {
		const candidate = queue[i];
		if (!candidate || isPendingLearning(candidate, now)) continue;

		const newQueue = [...queue];
		newQueue[currentIndex] = candidate;
		newQueue[i] = cursorCard;
		return { queue: newQueue, currentIndex, swappedWith: i };
	}

	return { ...snapshot, swappedWith: null };
}

/**
 * Remove the card at one index. The cursor keeps pointing at the same card
 * when possible; removing at or past the cursor may leave the cursor at
 * queue.length, which the phase getter reports as session complete.
 */
export function removeAt(
	snapshot: QueueSnapshot,
	index: number,
	now: Date = new Date(),
): QueueSnapshot {
	const { queue, currentIndex } = snapshot;
	if (index < 0 || index >= queue.length) return snapshot;

	const newQueue = [...queue];
	newQueue.splice(index, 1);
	const newIndex = index < currentIndex ? currentIndex - 1 : currentIndex;

	return promoteActionableCard(
		{ queue: newQueue, currentIndex: newIndex },
		now,
	);
}

/**
 * Remove every occurrence of the given ids (a card graded Again exists
 * twice: the answered copy before the cursor and the requeued copy after).
 */
export function removeByIds(
	snapshot: QueueSnapshot,
	cardIds: readonly string[],
	now: Date = new Date(),
): QueueSnapshot {
	const idsToRemove = new Set(cardIds);
	const { queue, currentIndex } = snapshot;

	let removedBeforeCurrent = 0;
	for (let i = 0; i < Math.min(currentIndex, queue.length); i++) {
		const card = queue[i];
		if (card && idsToRemove.has(card.id)) removedBeforeCurrent++;
	}

	const newQueue = queue.filter((card) => !idsToRemove.has(card.id));
	const newIndex = Math.max(0, currentIndex - removedBeforeCurrent);

	return promoteActionableCard(
		{ queue: newQueue, currentIndex: newIndex },
		now,
	);
}

/**
 * Insert a card at a position. Inserting strictly before the cursor shifts
 * it by +1 so the user stays on the same card; inserting exactly at the
 * cursor puts the new card under it (used by undo to restore the active
 * card) — so no promotion here.
 */
export function insertAt(
	snapshot: QueueSnapshot,
	card: FSRSFlashcardItem,
	position: number,
): QueueSnapshot {
	const { queue, currentIndex } = snapshot;
	const clampedPosition = Math.max(0, Math.min(position, queue.length));

	const newQueue = [...queue];
	newQueue.splice(clampedPosition, 0, card);

	const newIndex =
		clampedPosition < currentIndex ? currentIndex + 1 : currentIndex;

	return { queue: newQueue, currentIndex: newIndex };
}

/**
 * Commit an answer: the answered snapshot replaces the cursor card (kept
 * for progress history), an optional requeued copy is spliced in, and the
 * cursor advances to the next actionable card.
 */
export function advanceAfterAnswer(
	snapshot: QueueSnapshot,
	updatedCard: FSRSFlashcardItem,
	requeueData: { card: FSRSFlashcardItem; position: number } | undefined,
	now: Date = new Date(),
): AnswerAdvanceResult {
	const newQueue = [...snapshot.queue];
	newQueue[snapshot.currentIndex] = updatedCard;

	let requeuePosition: number | undefined;
	if (requeueData) {
		requeuePosition = Math.max(
			0,
			Math.min(requeueData.position, newQueue.length),
		);
		newQueue.splice(requeuePosition, 0, requeueData.card);
	}

	const nextIndex = snapshot.currentIndex + 1;
	const promoted = promoteActionableCard(
		{ queue: newQueue, currentIndex: nextIndex },
		now,
	);

	if (promoted.swappedWith !== null && requeuePosition !== undefined) {
		if (requeuePosition === nextIndex) requeuePosition = promoted.swappedWith;
		else if (requeuePosition === promoted.swappedWith)
			requeuePosition = nextIndex;
	}

	return {
		queue: promoted.queue,
		currentIndex: nextIndex,
		requeuePosition,
	};
}
