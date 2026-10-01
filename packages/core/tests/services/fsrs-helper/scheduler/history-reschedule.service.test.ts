import { Rating, State } from "ts-fsrs";
import { describe, expect, it, vi } from "vitest";

import type {
	HistoryRescheduleCard,
	HistoryRescheduleLog,
} from "../../../../src/metrics/fsrs-tools/scheduler/history-reschedule.service";
import {
	HistoryRescheduleService,
	sameSchedulingState,
} from "../../../../src/metrics/fsrs-tools/scheduler/history-reschedule.service";
import type { SqliteStoreService } from "../../../../src/persistence/sqlite/SqliteStoreService";
import { FSRSService } from "../../../../src/services/fsrs/fsrs.service";
import type { FSRSCardData } from "../../../../src/types";
import type { FSRSSettings } from "../../../../src/types/settings.types";
import { createDefaultFSRSSettings } from "../../../mocks/fsrs.mocks";

const DAY = 86_400_000;
const base = new Date("2026-06-01T08:00:00Z").getTime();
const at = (days: number) => new Date(base + days * DAY).toISOString();

function settings(over: Partial<FSRSSettings> = {}): FSRSSettings {
	return { ...createDefaultFSRSSettings(), enableFuzz: false, ...over };
}

function log(
	cardId: string,
	n: number,
	days: number,
	rating: number,
	state: State,
	presetName: string | null = null,
): HistoryRescheduleLog {
	return {
		id: `${cardId}-${n}`,
		cardId,
		reviewedAt: at(days),
		rating,
		state,
		presetName,
		deviceId: null,
		reviewKind: null,
		deletedAt: null,
	};
}

/** New card answered Good, then Good after 3, 10 days */
function easyHistory(cardId: string): HistoryRescheduleLog[] {
	return [
		log(cardId, 1, 0, Rating.Good, State.New),
		log(cardId, 2, 3, Rating.Good, State.Review),
		log(cardId, 3, 13, Rating.Good, State.Review),
	];
}

function reviewCard(id: string, dueDays: number): HistoryRescheduleCard {
	return {
		id,
		due: at(dueDays),
		state: State.Review,
		stability: 5,
		difficulty: 9.5,
		reps: 3,
		lapses: 0,
		lastReview: at(13),
		scheduledDays: dueDays - 13,
		learningStep: 0,
		sourceUid: "note-a",
	};
}

const tomorrowBoundary = new Date(base + 20 * DAY);
const now = new Date(base + 19 * DAY);
const opts = { tomorrowBoundary, now };

describe("HistoryRescheduleService.plan", () => {
	const service = new HistoryRescheduleService(new FSRSService(settings()));

	it("replays the history into a fresh memory state", async () => {
		const card = reviewCard("c1", 30);
		const { changes, summary } = await service.plan(
			[card],
			new Map([["c1", easyHistory("c1")]]),
			() => settings(),
			{ ...opts, mode: "full" },
		);
		expect(summary.rescheduled).toBe(1);
		expect(changes[0]?.source).toBe("replay");
		const after = changes[0]?.after;
		expect(after?.state).toBe(State.Review);
		expect(after?.reps).toBe(3);
		expect(after?.lastReview).toBe(at(13));
		// Three Good answers must not leave the card at the stored D=9.5
		expect(after?.difficulty).toBeLessThan(9);
		// The full previous state is kept for undo
		expect(changes[0]?.before.difficulty).toBe(9.5);
		expect(changes[0]?.before).not.toHaveProperty("sourceUid");
	});

	it("postpone-only never moves a card earlier than scheduled", async () => {
		const farFuture = reviewCard("c1", 400);
		const { changes, summary } = await service.plan(
			[farFuture],
			new Map([["c1", easyHistory("c1")]]),
			() => settings(),
			opts,
		);
		expect(changes[0]?.after.due).toBe(farFuture.due);
		expect(new Date(changes[0]?.modelDue ?? 0).getTime()).toBeLessThan(
			new Date(farFuture.due).getTime(),
		);
		expect(summary.movedEarlier).toBe(0);
		expect(summary.keptDate).toBe(1);
	});

	it("full mode applies the model's due even when earlier", async () => {
		const farFuture = reviewCard("c1", 400);
		const { changes, summary } = await service.plan(
			[farFuture],
			new Map([["c1", easyHistory("c1")]]),
			() => settings(),
			{ ...opts, mode: "full" },
		);
		expect(changes[0]?.after.due).toBe(changes[0]?.modelDue);
		expect(summary.movedEarlier).toBe(1);
	});

	it("recomputes partial histories from the stored memory state", async () => {
		const card = { ...reviewCard("c1", 30), stability: 100, difficulty: 3 };
		const partial = easyHistory("c1").slice(1);
		const { changes, summary } = await service.plan(
			[card],
			new Map([["c1", partial]]),
			() => settings(),
			{ ...opts, mode: "full" },
		);
		expect(summary.fromStoredState).toBe(1);
		expect(changes[0]?.source).toBe("stored-state");
		// Memory state kept, only the interval is new
		expect(changes[0]?.after.stability).toBe(100);
		expect(changes[0]?.after.difficulty).toBe(3);
		expect(changes[0]?.after.lastReview).toBe(card.lastReview);
		// S=100 at retention 0.9 gives an interval near 100 days
		expect(changes[0]?.after.scheduledDays).toBeGreaterThan(80);
		expect(changes[0]?.after.scheduledDays).toBeLessThan(120);
	});

	it("also handles cards with no history at all", async () => {
		const card = { ...reviewCard("c1", 30), stability: 40 };
		const { summary } = await service.plan(
			[card],
			new Map(),
			() => settings(),
			opts,
		);
		expect(summary.fromStoredState).toBe(1);
		const noState = { ...reviewCard("c2", 30), lastReview: null };
		const skipped = await service.plan(
			[noState],
			new Map(),
			() => settings(),
			opts,
		);
		expect(skipped.summary.skipped.noUsableState).toBe(1);
		expect(skipped.changes).toHaveLength(0);
	});

	it("ignores preview, deleted and non-Review cards", async () => {
		const logs = [
			...easyHistory("c1"),
			{
				...log("c1", 9, 14, Rating.Again, State.Review),
				reviewKind: "preview",
			},
			{ ...log("c1", 10, 15, Rating.Again, State.Review), deletedAt: 1 },
		];
		const learning: HistoryRescheduleCard = {
			...reviewCard("c2", 30),
			state: State.Learning,
		};
		const suspended: HistoryRescheduleCard = {
			...reviewCard("c3", 30),
			suspended: true,
		};
		const { changes, summary } = await service.plan(
			[reviewCard("c1", 30), learning, suspended],
			new Map([["c1", logs]]),
			() => settings(),
			{ ...opts, mode: "full" },
		);
		expect(summary.reviewCards).toBe(1);
		expect(changes).toHaveLength(1);
		expect(changes[0]?.after.lapses).toBe(0);
	});

	it("counts due-today before/after and the visible subset", async () => {
		const overdue = reviewCard("c1", 5); // before tomorrowBoundary
		const archived = { ...reviewCard("c2", 5), sourceUid: "archived" };
		const { summary } = await service.plan(
			[overdue, archived],
			new Map([
				["c1", easyHistory("c1")],
				["c2", easyHistory("c2")],
			]),
			() => settings(),
			{ ...opts, countExcludedSourceUids: new Set(["archived"]) },
		);
		expect(summary.dueToday.before).toBe(2);
		expect(summary.visible?.dueToday.before).toBe(1);
	});

	it("uses the per-card preset settings", async () => {
		const card = reviewCard("c1", 30);
		const history = new Map([["c1", easyHistory("c1")]]);
		const low = await service.plan(
			[card],
			history,
			() => settings({ requestRetention: 0.8 }),
			{ ...opts, mode: "full" },
		);
		const high = await service.plan(
			[card],
			history,
			() => settings({ requestRetention: 0.95 }),
			{ ...opts, mode: "full" },
		);
		expect(new Date(low.changes[0]?.after.due ?? 0).getTime()).toBeGreaterThan(
			new Date(high.changes[0]?.after.due ?? 0).getTime(),
		);
	});

	it("passes the preset of the latest review to the resolver", async () => {
		const history = [
			log("c1", 1, 0, Rating.Good, State.New, "Default"),
			log("c1", 2, 3, Rating.Good, State.Review, "Exam"),
		];
		const resolver = vi.fn(() => settings());
		await service.plan(
			[reviewCard("c1", 30)],
			new Map([["c1", history]]),
			resolver,
			opts,
		);
		expect(resolver).toHaveBeenCalledWith(
			expect.objectContaining({ id: "c1" }),
			"Exam",
		);
	});

	it("does not apply the first-interval cap retroactively", async () => {
		const card = reviewCard("c1", 30);
		const onlyGraduated = new Map([
			["c1", [log("c1", 1, 0, Rating.Good, State.New)]],
		]);
		const plain = await service.plan([card], onlyGraduated, () => settings(), {
			...opts,
			mode: "full",
		});
		const capped = await service.plan(
			[card],
			onlyGraduated,
			() => settings({ firstIntervalMax: 1 }),
			{ ...opts, mode: "full" },
		);
		expect(capped.changes[0]?.after.due).toBe(plain.changes[0]?.after.due);
	});

	it("yields control while planning many cards", async () => {
		const cards = Array.from({ length: 25 }, (_, i) => reviewCard(`c${i}`, 30));
		const history = new Map(cards.map((c) => [c.id, easyHistory(c.id)]));
		const yieldControl = vi.fn(async () => {});
		await service.plan(cards, history, () => settings(), {
			...opts,
			yieldControl,
			yieldEvery: 10,
		});
		expect(yieldControl).toHaveBeenCalledTimes(2);
	});
});

describe("HistoryRescheduleService.run", () => {
	function fakeStore(cards: HistoryRescheduleCard[]) {
		const rows = new Map<string, FSRSCardData>(
			cards.map(({ sourceUid: _s, ...c }) => [c.id, { ...c }]),
		);
		const logs = cards.flatMap((c) => easyHistory(c.id));
		const store = {
			cards: {
				getAll: () => cards,
				get: (id: string) => rows.get(id),
				applyReplayedScheduling: vi.fn((id: string, data: FSRSCardData) => {
					rows.set(id, data);
				}),
			},
			stats: { getAllReplayLogs: () => logs },
			transaction: <T>(fn: () => T) => fn(),
		};
		return { store: store as unknown as SqliteStoreService, rows, raw: store };
	}

	const service = new HistoryRescheduleService(new FSRSService(settings()));

	it("dry run writes nothing", async () => {
		const { store, raw } = fakeStore([reviewCard("c1", 30)]);
		const result = await service.run(store, () => settings(), opts);
		expect(result.changes).toHaveLength(1);
		expect(raw.cards.applyReplayedScheduling).not.toHaveBeenCalled();
	});

	it("skips cards answered while the plan was computed", async () => {
		const { store, rows, raw } = fakeStore([
			reviewCard("c1", 30),
			reviewCard("c2", 30),
		]);
		const answered = { ...(rows.get("c2") as FSRSCardData), reps: 4 };
		const yieldControl = async () => {
			rows.set("c2", answered);
		};
		const result = await service.run(store, () => settings(), {
			...opts,
			dryRun: false,
			yieldControl,
			yieldEvery: 1,
		});
		expect(result.changes.map((c) => c.cardId)).toEqual(["c1"]);
		expect(result.staleSkipped).toBe(1);
		expect(raw.cards.applyReplayedScheduling).toHaveBeenCalledTimes(1);
		expect(rows.get("c2")).toBe(answered);
	});
});

describe("sameSchedulingState", () => {
	it("compares due, lastReview, state and reps", () => {
		const { sourceUid: _s, ...card } = reviewCard("c1", 30);
		expect(sameSchedulingState(card, card)).toBe(true);
		expect(sameSchedulingState(undefined, card)).toBe(false);
		expect(sameSchedulingState({ ...card, reps: 9 }, card)).toBe(false);
		expect(sameSchedulingState({ ...card, due: at(31) }, card)).toBe(false);
	});
});
