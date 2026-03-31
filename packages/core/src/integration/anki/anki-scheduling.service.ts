import type { FSRSService } from "@true-recall/core/services/fsrs/fsrs.service";
import type {
	AnkiCard,
	AnkiRevlogEntry,
	FSRSCardData,
	Grade,
} from "@true-recall/core/types";
import { State } from "ts-fsrs";

const VALID_EASE_MIN = 1;
const VALID_EASE_MAX = 4;

// Anki queue values for special states
const ANKI_QUEUE_SUSPENDED = -1;
const ANKI_QUEUE_BURIED_SCHED = -2;
const ANKI_QUEUE_BURIED_USER = -3;

// Anki factor is ease * 1000 (default 2500 = ease 2.5)
const ANKI_FACTOR_DIVISOR = 1000;

// FSRS difficulty bounds
const DIFFICULTY_MIN = 1;
const DIFFICULTY_MAX = 10;
const DIFFICULTY_INVERSION_CONSTANT = 11;

export class AnkiSchedulingService {
	constructor(private fsrsService: FSRSService) {}

	replayScheduling(
		cardId: string,
		ankiCard: AnkiCard,
		revlogs: AnkiRevlogEntry[],
	): FSRSCardData {
		const sorted = [...revlogs].sort((a, b) => a.id - b.id);

		let card = this.fsrsService.createNewCard(cardId);

		for (const entry of sorted) {
			const rating = this.clampEase(entry.ease);
			const reviewTime = new Date(entry.id);
			card = this.fsrsService.scheduleCard(card, rating, reviewTime);
		}

		return this.applyStatus(card, ankiCard);
	}

	mapSchedulingDirect(cardId: string, ankiCard: AnkiCard): FSRSCardData {
		const now = new Date();
		const state = this.mapAnkiTypeToState(ankiCard.type);

		const card = this.fsrsService.createNewCard(cardId);

		card.state = state;
		card.reps = ankiCard.reps;
		card.lapses = ankiCard.lapses;
		card.scheduledDays = Math.max(0, ankiCard.ivl);
		card.learningStep = 0;
		card.lastReview = null;

		if (state === State.Review && ankiCard.ivl > 0) {
			// For mature cards, stability approximates the current interval
			card.stability = ankiCard.ivl;
		}

		if (ankiCard.factor > 0) {
			// Anki ease 2.5 (factor 2500) maps to ~mid difficulty
			// Lower ease = harder card = higher difficulty number
			const ease = ankiCard.factor / ANKI_FACTOR_DIVISOR;
			card.difficulty = Math.max(
				DIFFICULTY_MIN,
				Math.min(DIFFICULTY_MAX, DIFFICULTY_INVERSION_CONSTANT - ease),
			);
		}

		if (state === State.New) {
			card.due = now.toISOString();
		} else if (state === State.Review && ankiCard.ivl > 0) {
			// Without revlog we can't know the exact due date, use current time
			// as a reasonable default — the card will appear in the next review session
			card.due = now.toISOString();
		}

		return this.applyStatus(card, ankiCard);
	}

	convert(
		cardId: string,
		ankiCard: AnkiCard,
		revlogs: AnkiRevlogEntry[],
	): FSRSCardData {
		if (revlogs.length > 0) {
			return this.replayScheduling(cardId, ankiCard, revlogs);
		}
		return this.mapSchedulingDirect(cardId, ankiCard);
	}

	private clampEase(ease: number): Grade {
		return Math.max(VALID_EASE_MIN, Math.min(VALID_EASE_MAX, ease)) as Grade;
	}

	private mapAnkiTypeToState(ankiType: number): State {
		// Anki type: 0=New, 1=Learning, 2=Review, 3=Relearning — same as FSRS
		if (ankiType >= 0 && ankiType <= 3) {
			return ankiType as State;
		}
		return State.New;
	}

	private applyStatus(card: FSRSCardData, ankiCard: AnkiCard): FSRSCardData {
		if (ankiCard.queue === ANKI_QUEUE_SUSPENDED) {
			card.suspended = true;
		}

		if (
			ankiCard.queue === ANKI_QUEUE_BURIED_USER ||
			ankiCard.queue === ANKI_QUEUE_BURIED_SCHED
		) {
			// Unbury at next day boundary (4 AM like Anki default)
			const tomorrow = new Date();
			tomorrow.setDate(tomorrow.getDate() + 1);
			tomorrow.setHours(4, 0, 0, 0);
			card.buriedUntil = tomorrow.toISOString();
		}

		return card;
	}
}
