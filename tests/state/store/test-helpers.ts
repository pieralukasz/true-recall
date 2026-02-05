import { State } from "ts-fsrs";
import type { AppStoreDeps } from "../../../src/state/store";
import type { FSRSFlashcardItem } from "../../../src/types";
import { createAppStore } from "../../../src/state/store";

export function createMockDeps(): AppStoreDeps {
	return {
		app: {} as any,
		cardStore: {} as any,
		dayBoundaryService: {} as any,
		frontmatterIndex: {} as any,
		eventBus: {} as any,
		getSettings: () => ({
			dayStartHour: 4,
		}) as any,
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
