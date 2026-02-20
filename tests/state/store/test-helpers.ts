import { State } from "ts-fsrs";
import type { App } from "obsidian";
import type { AppStoreDeps, BadgeCounts } from "../../../src/shared/store";
import type { FSRSFlashcardItem, TrueRecallSettings } from "../../../src/shared/types";
import type { SqliteStoreService } from "../../../src/features/core/persistence/sqlite/SqliteStoreService";
import type { DayBoundaryService } from "../../../src/features/core/services/day-boundary.service";
import type { FrontmatterIndexService } from "../../../src/features/core/services/frontmatter-index.service";
import { createAppStore } from "../../../src/shared/store";

export function createMockDeps(): AppStoreDeps {
	return {
		app: {} as unknown as App,
		cardStore: {} as unknown as SqliteStoreService,
		dayBoundaryService: {} as unknown as DayBoundaryService,
		frontmatterIndex: {} as unknown as FrontmatterIndexService,
		getSettings: () => ({
			dayStartHour: 4,
		}) as TrueRecallSettings,
	};
}

export function createTestStore() {
	return createAppStore(createMockDeps());
}

export function createMockCard(overrides: Partial<FSRSFlashcardItem> = {}): FSRSFlashcardItem {
	return {
		id: `card-${Math.random().toString(36).slice(2)}`,
		question: "Test question",
		answer: "Test answer",
		sourceUid: "source-123",
		sourceNotePath: "/path/to/note.md",
		sourceNoteName: "note",
		fsrs: {
			due: new Date().toISOString(),
			stability: 1,
			difficulty: 5,
			elapsedDays: 0,
			scheduledDays: 0,
			reps: 0,
			lapses: 0,
			state: State.New,
			lastReview: null,
			suspended: false,
			buriedUntil: null,
		},
		...overrides,
	};
}

export function createMockCardWithState(state: State, dueOffset = 0): FSRSFlashcardItem {
	const due = new Date();
	due.setMinutes(due.getMinutes() + dueOffset);

	return createMockCard({
		fsrs: {
			due: due.toISOString(),
			stability: 1,
			difficulty: 5,
			elapsedDays: 0,
			scheduledDays: 0,
			reps: state === State.New ? 0 : 1,
			lapses: 0,
			state,
			lastReview: state === State.New ? null : new Date().toISOString(),
			suspended: false,
			buriedUntil: null,
		},
	});
}

/**
 * Manually count cards in remaining queue (for verification against cached counts)
 */
export function countRemainingCards(
	queue: FSRSFlashcardItem[],
	currentIndex: number
): BadgeCounts {
	const counts: BadgeCounts = { new: 0, learning: 0, due: 0 };

	for (let i = currentIndex; i < queue.length; i++) {
		const card = queue[i];
		if (!card) continue;

		switch (card.fsrs.state) {
			case State.New:
				counts.new++;
				break;
			case State.Learning:
			case State.Relearning:
				counts.learning++;
				break;
			case State.Review:
				counts.due++;
				break;
		}
	}

	return counts;
}
