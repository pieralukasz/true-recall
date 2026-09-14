import initSqlJs from "sql.js";
import { State } from "ts-fsrs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS } from "@true-recall/core/constants";
import { FlashcardManager } from "@true-recall/core/flashcard/flashcard.service";
import { SqliteStoreService } from "@true-recall/core/persistence/sqlite/SqliteStoreService";
import type { FSRSCardData, FSRSFlashcardItem } from "@true-recall/core/types";

import type { CommandContext } from "@true-recall/obsidian/commands/command.types";
import {
	ReviewDeleteCommand,
	ReviewForgetCommand,
} from "@true-recall/obsidian/commands/commands/review-actions.cmd";

import { MapPersistence } from "../../../core/tests/mocks/map-persistence.mock";
import { TestSqlJsWrapper } from "../../../core/tests/persistence/sqlite/__setup__/test-database";
import { createMockCard, createTestStore } from "../store/test-helpers";

vi.mock("@true-recall/obsidian/data", () => ({
	mutate: vi.fn(),
	mutateReviewGrade: vi.fn(),
}));

interface Harness {
	card: FSRSFlashcardItem;
	cardStore: SqliteStoreService;
	ctx: CommandContext;
	review: ReturnType<typeof createTestStore>;
}

function createSqliteStore(): SqliteStoreService {
	const cardStore = new SqliteStoreService(new MapPersistence(), "testdev1", {
		saveDebounceMs: 60_000,
	});
	const sqliteDb = cardStore.getSqliteDb();
	(
		sqliteDb as unknown as {
			init: (bytes: Uint8Array | null) => Promise<void>;
		}
	).init = async (bytes) => {
		const SQL = await initSqlJs();
		const raw = bytes ? new SQL.Database(bytes) : new SQL.Database();
		(sqliteDb as unknown as { db: unknown }).db = new TestSqlJsWrapper(raw);
	};
	return cardStore;
}

async function createHarness(state: State): Promise<Harness> {
	const cardStore = createSqliteStore();
	await cardStore.load();

	const card = createMockCard({
		id: "integration-card",
		fsrs: {
			due: "2026-09-05T12:00:00.000Z",
			stability: state === State.New ? 0 : 10,
			difficulty: 5,
			elapsedDays: state === State.New ? 0 : 10,
			scheduledDays: state === State.New ? 0 : 10,
			reps: state === State.New ? 0 : 3,
			lapses: state === State.New ? 0 : 1,
			state,
			lastReview: state === State.New ? null : "2026-08-26T12:00:00.000Z",
			suspended: false,
			buriedUntil: null,
		},
	});
	const storedCard: FSRSCardData = {
		...card.fsrs,
		id: card.id,
		learningStep: 0,
		question: card.question,
		answer: card.answer,
		sourceUid: card.sourceUid,
		buriedUntil: undefined,
	};
	cardStore.set(card.id, storedCard);

	const flashcardManager = new FlashcardManager(
		{} as never,
		{} as never,
		DEFAULT_SETTINGS,
	);
	flashcardManager.setStore(cardStore);

	const review = createTestStore();
	review.getState().review.startSession([card]);
	const sessionPersistence = {
		getTodayKey: vi.fn(() => "2026-09-05"),
		removeReviewedCards: vi.fn(),
	};
	const ctx = {
		flashcardManager,
		cardStore,
		sessionPersistence,
	} as unknown as CommandContext;

	return { card, cardStore, ctx, review };
}

describe("review actions with production SQLite transactions", () => {
	let cardStore: SqliteStoreService | undefined;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-09-05T12:00:00.000Z"));
	});

	afterEach(() => {
		cardStore?.haltPersistence();
		cardStore?.getSqliteDb().close();
		cardStore = undefined;
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("soft-deletes a card through ReviewDeleteCommand", async () => {
		const harness = await createHarness(State.New);
		cardStore = harness.cardStore;
		const command = new ReviewDeleteCommand({
			card: harness.card,
			originalFsrs: { ...harness.card.fsrs },
			previousIndex: 0,
			siblingIds: [harness.card.id],
			getReview: () => harness.review.getState().review,
		});

		command.execute(harness.ctx);
		await vi.advanceTimersByTimeAsync(0);

		expect(harness.cardStore.get(harness.card.id)).toBeUndefined();
		expect(harness.review.getState().review.queue).toHaveLength(0);
	});

	it("resets a reviewed card through ReviewForgetCommand", async () => {
		const harness = await createHarness(State.Review);
		cardStore = harness.cardStore;
		const command = new ReviewForgetCommand({
			card: harness.card,
			originalFsrs: { ...harness.card.fsrs },
			previousIndex: 0,
			siblingIds: [harness.card.id],
			getReview: () => harness.review.getState().review,
		});

		command.execute(harness.ctx);
		await vi.advanceTimersByTimeAsync(0);

		expect(harness.cardStore.get(harness.card.id)).toMatchObject({
			state: State.New,
			reps: 0,
			lapses: 0,
			stability: 0,
			difficulty: 0,
		});
		expect(harness.review.getState().review.queue).toHaveLength(0);
	});
});
