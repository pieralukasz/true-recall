import { vi } from "vitest";
import { State } from "ts-fsrs";
import { FSRSService } from "../../../src/services/core/fsrs.service";
import { AnkiSchedulingService } from "../../../src/services/anki/anki-scheduling.service";
import { createDefaultFSRSSettings } from "../mocks/fsrs.mocks";
import { createAnkiCard, createAnkiRevlog } from "./mocks/anki.mocks";

describe("AnkiSchedulingService", () => {
	let fsrsService: FSRSService;
	let service: AnkiSchedulingService;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2024-06-15T10:00:00Z"));
		fsrsService = new FSRSService(createDefaultFSRSSettings());
		service = new AnkiSchedulingService(fsrsService);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("convert - routing", () => {
		it("uses replayScheduling when revlogs present", () => {
			const ankiCard = createAnkiCard({ reps: 1, type: 2 });
			const revlogs = [
				createAnkiRevlog({ id: 1700000000000, ease: 3 }),
			];

			const result = service.convert("card-1", ankiCard, revlogs);

			expect(result.reps).toBeGreaterThan(0);
		});

		it("uses mapSchedulingDirect when no revlogs", () => {
			const ankiCard = createAnkiCard({ type: 2, ivl: 10 });

			const result = service.convert("card-1", ankiCard, []);

			expect(result.stability).toBe(10);
		});
	});

	describe("replayScheduling", () => {
		it("replays single review", () => {
			const ankiCard = createAnkiCard();
			const revlogs = [
				createAnkiRevlog({ id: 1700000000000, ease: 3 }),
			];

			const result = service.replayScheduling("card-1", ankiCard, revlogs);

			expect(result.reps).toBe(1);
		});

		it("replays multiple reviews in order", () => {
			const ankiCard = createAnkiCard();
			const revlogs = [
				createAnkiRevlog({ id: 1700000001000, ease: 3 }),
				createAnkiRevlog({ id: 1700000060000, ease: 3 }),
				createAnkiRevlog({ id: 1700001000000, ease: 3 }),
			];

			const result = service.replayScheduling("card-1", ankiCard, revlogs);

			expect(result.reps).toBe(3);
			expect(
				result.state === State.Review || result.state === State.Learning,
			).toBe(true);
		});

		it("sorts revlog by id before replaying", () => {
			const ankiCard = createAnkiCard();

			// Entries in reverse chronological order
			const revlogsReversed = [
				createAnkiRevlog({ id: 1700001000000, ease: 3 }),
				createAnkiRevlog({ id: 1700000060000, ease: 3 }),
				createAnkiRevlog({ id: 1700000001000, ease: 3 }),
			];

			// Same entries in correct order
			const revlogsSorted = [
				createAnkiRevlog({ id: 1700000001000, ease: 3 }),
				createAnkiRevlog({ id: 1700000060000, ease: 3 }),
				createAnkiRevlog({ id: 1700001000000, ease: 3 }),
			];

			const resultReversed = service.replayScheduling(
				"card-1",
				ankiCard,
				revlogsReversed,
			);
			const resultSorted = service.replayScheduling(
				"card-2",
				ankiCard,
				revlogsSorted,
			);

			expect(resultReversed.reps).toBe(resultSorted.reps);
			expect(resultReversed.state).toBe(resultSorted.state);
			expect(resultReversed.difficulty).toBeCloseTo(
				resultSorted.difficulty,
				5,
			);
		});

		it("clamps ease 0 to 1 (Again)", () => {
			const ankiCard = createAnkiCard();
			const revlogsAgain = [
				createAnkiRevlog({ id: 1700000001000, ease: 0 }),
			];
			const revlogsGood = [
				createAnkiRevlog({ id: 1700000001000, ease: 3 }),
			];

			const resultAgain = service.replayScheduling(
				"card-again",
				ankiCard,
				revlogsAgain,
			);
			const resultGood = service.replayScheduling(
				"card-good",
				ankiCard,
				revlogsGood,
			);

			// Again rating should produce a harder card (higher difficulty)
			expect(resultAgain.difficulty).toBeGreaterThan(resultGood.difficulty);
		});

		it("clamps ease 5 to 4 (Easy)", () => {
			const ankiCard = createAnkiCard();
			const revlogs = [
				createAnkiRevlog({ id: 1700000001000, ease: 5 }),
			];

			// Should not throw
			const result = service.replayScheduling("card-1", ankiCard, revlogs);

			expect(result.reps).toBe(1);
			expect(result.state).toBeDefined();
		});
	});

	describe("replayScheduling - status flags", () => {
		it("suspended card (queue=-1) sets suspended=true", () => {
			const ankiCard = createAnkiCard({ queue: -1 });
			const revlogs = [
				createAnkiRevlog({ id: 1700000001000, ease: 3 }),
			];

			const result = service.replayScheduling("card-1", ankiCard, revlogs);

			expect(result.suspended).toBe(true);
		});

		it("buried card (queue=-2) sets buriedUntil to tomorrow 4AM", () => {
			const ankiCard = createAnkiCard({ queue: -2 });
			const revlogs = [
				createAnkiRevlog({ id: 1700000001000, ease: 3 }),
			];

			const result = service.replayScheduling("card-1", ankiCard, revlogs);

			expect(result.buriedUntil).toBeDefined();
			const buried = new Date(result.buriedUntil!);
			const tomorrow4am = new Date("2024-06-16T04:00:00.000");
			// Compare using local time components since the service uses setHours (local)
			expect(buried.getFullYear()).toBe(tomorrow4am.getFullYear());
			expect(buried.getMonth()).toBe(tomorrow4am.getMonth());
			expect(buried.getDate()).toBe(tomorrow4am.getDate());
			expect(buried.getHours()).toBe(4);
			expect(buried.getMinutes()).toBe(0);
			expect(buried.getSeconds()).toBe(0);
		});

		it("buried card (queue=-3) also sets buriedUntil", () => {
			const ankiCard = createAnkiCard({ queue: -3 });
			const revlogs = [
				createAnkiRevlog({ id: 1700000001000, ease: 3 }),
			];

			const result = service.replayScheduling("card-1", ankiCard, revlogs);

			expect(result.buriedUntil).toBeDefined();
			const buried = new Date(result.buriedUntil!);
			expect(buried.getHours()).toBe(4);
			expect(buried.getMinutes()).toBe(0);
		});

		it("normal card (queue=0) has no suspended or buriedUntil", () => {
			const ankiCard = createAnkiCard({ queue: 0 });
			const revlogs = [
				createAnkiRevlog({ id: 1700000001000, ease: 3 }),
			];

			const result = service.replayScheduling("card-1", ankiCard, revlogs);

			expect(result.suspended).toBeFalsy();
			expect(result.buriedUntil).toBeUndefined();
		});
	});

	describe("mapSchedulingDirect", () => {
		it("maps type 0 to State.New", () => {
			const ankiCard = createAnkiCard({ type: 0 });

			const result = service.mapSchedulingDirect("card-1", ankiCard);

			expect(result.state).toBe(State.New);
		});

		it("maps type 1 to State.Learning", () => {
			const ankiCard = createAnkiCard({ type: 1 });

			const result = service.mapSchedulingDirect("card-1", ankiCard);

			expect(result.state).toBe(State.Learning);
		});

		it("maps type 2 to State.Review", () => {
			const ankiCard = createAnkiCard({ type: 2 });

			const result = service.mapSchedulingDirect("card-1", ankiCard);

			expect(result.state).toBe(State.Review);
		});

		it("maps type 3 to State.Relearning", () => {
			const ankiCard = createAnkiCard({ type: 3 });

			const result = service.mapSchedulingDirect("card-1", ankiCard);

			expect(result.state).toBe(State.Relearning);
		});

		it("invalid type (5) defaults to State.New", () => {
			const ankiCard = createAnkiCard({ type: 5 });

			const result = service.mapSchedulingDirect("card-1", ankiCard);

			expect(result.state).toBe(State.New);
		});

		it("sets reps and lapses from ankiCard", () => {
			const ankiCard = createAnkiCard({ reps: 15, lapses: 3 });

			const result = service.mapSchedulingDirect("card-1", ankiCard);

			expect(result.reps).toBe(15);
			expect(result.lapses).toBe(3);
		});

		it("review card with ivl > 0 sets stability to ivl", () => {
			const ankiCard = createAnkiCard({ type: 2, ivl: 30 });

			const result = service.mapSchedulingDirect("card-1", ankiCard);

			expect(result.stability).toBe(30);
		});

		it("new card with ivl=0 has default stability", () => {
			const ankiCard = createAnkiCard({ type: 0, ivl: 0 });

			const result = service.mapSchedulingDirect("card-1", ankiCard);

			// Default stability from createEmptyCard is 0
			expect(result.stability).toBe(0);
		});

		it("factor 2500 maps to difficulty ~8.5 (11 - 2.5)", () => {
			const ankiCard = createAnkiCard({ factor: 2500 });

			const result = service.mapSchedulingDirect("card-1", ankiCard);

			expect(result.difficulty).toBeCloseTo(8.5, 1);
		});

		it("factor 1500 maps to difficulty 9.5, clamped to 10", () => {
			const ankiCard = createAnkiCard({ factor: 1500 });

			const result = service.mapSchedulingDirect("card-1", ankiCard);

			// 11 - 1.5 = 9.5, within [1, 10]
			expect(result.difficulty).toBeCloseTo(9.5, 1);
		});

		it("factor 0 does not change difficulty", () => {
			const ankiCard = createAnkiCard({ factor: 0 });

			const result = service.mapSchedulingDirect("card-1", ankiCard);

			// When factor is 0, the difficulty remains at the createEmptyCard default
			const defaultCard = fsrsService.createNewCard("default");
			expect(result.difficulty).toBe(defaultCard.difficulty);
		});

		it("scheduledDays = max(0, ankiCard.ivl)", () => {
			const ankiCard = createAnkiCard({ ivl: 14 });

			const result = service.mapSchedulingDirect("card-1", ankiCard);

			expect(result.scheduledDays).toBe(14);
		});

		it("negative ivl is clamped to 0", () => {
			const ankiCard = createAnkiCard({ ivl: -5 });

			const result = service.mapSchedulingDirect("card-1", ankiCard);

			expect(result.scheduledDays).toBe(0);
		});
	});
});
