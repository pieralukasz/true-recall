import { vi } from "vitest";
import {
	createAnkiNote,
	createAnkiCard,
	createAnkiModel,
	createClozeModel,
	createReversedModel,
	createAnkiDeck,
	createApkgData,
} from "./mocks/anki.mocks";

// Mock ApkgParserService so importApkg does not try to unzip real files
const mockParseApkg = vi.fn();
vi.mock("../../../src/features/integration/services/anki/apkg-parser.service", () => ({
	ApkgParserService: vi.fn().mockImplementation(() => ({
		parseApkg: mockParseApkg,
	})),
}));

// Mock generateUUID to produce deterministic, unique IDs
let uuidCounter = 0;
vi.mock("../../../src/features/core/persistence/sqlite/sqlite.types", () => ({
	generateUUID: vi.fn(() => `uuid-${++uuidCounter}`),
}));

// Mock signals
const mockNotifyCardChange = vi.fn();
vi.mock("../../../src/shared/services/signals", () => ({
	notifyCardChange: (...args: unknown[]) => mockNotifyCardChange(...args),
}));

// Import after mocks are set up
import { AnkiImportService } from "../../../src/features/integration/services/anki/anki-import.service";
import type { AnkiImportOptions } from "../../../src/shared/types";

function createMockApp(): any {
	const files: Record<string, ArrayBuffer> = {};
	return {
		vault: {
			adapter: {
				exists: vi.fn(async (path: string) => path in files),
				writeBinary: vi.fn(async (path: string, data: ArrayBuffer) => {
					files[path] = data;
				}),
				readBinary: vi.fn(async (path: string) => files[path] ?? new ArrayBuffer(0)),
				mkdir: vi.fn(async () => {}),
			},
			getFiles: vi.fn(() => []),
			getAbstractFileByPath: vi.fn(() => null),
			createFolder: vi.fn(async () => {}),
			create: vi.fn(async () => {}),
		},
		metadataCache: {
			getFileCache: vi.fn(() => null),
		},
	};
}

function createMockStore(): any {
	const noteTypes: any[] = [];
	return {
		cards: {
			getCardIdByQuestion: vi.fn(() => null),
			getCardIdByQuestionAndClozeIndex: vi.fn(() => null),
			updateCardSourceUid: vi.fn(),
		},
		set: vi.fn(),
		flush: vi.fn(async () => {}),
		transaction: vi.fn((fn: () => void) => fn()),
		stats: {
			upsertReviewLogFromRemote: vi.fn(),
		},
		noteTypes: {
			getAll: vi.fn(() => noteTypes),
			getBySlug: vi.fn(() => null),
			create: vi.fn((nt: any) => noteTypes.push(nt)),
		},
		notes: {
			create: vi.fn(),
		},
	};
}

function createMockFsrsService(): any {
	return {
		createNewCard: vi.fn((id: string) => ({
			id,
			state: 0,
			due: new Date().toISOString(),
			stability: 0,
			difficulty: 0,
			reps: 0,
			lapses: 0,
			lastReview: null,
			scheduledDays: 0,
			learningStep: 0,
			suspended: false,
			createdAt: Date.now(),
		})),
		scheduleCard: vi.fn((card) => ({ ...card, reps: card.reps + 1 })),
	};
}

function defaultOptions(overrides: Partial<AnkiImportOptions> = {}): AnkiImportOptions {
	return {
		importScheduling: false,
		importMedia: false,
		mediaFolder: "anki-media",
		...overrides,
	};
}

describe("AnkiImportService", () => {
	let app: any;
	let store: any;
	let fsrsService: any;
	let service: AnkiImportService;

	beforeEach(() => {
		vi.clearAllMocks();
		uuidCounter = 0;

		app = createMockApp();
		store = createMockStore();
		fsrsService = createMockFsrsService();
		service = new AnkiImportService(app, store, fsrsService);
	});

	describe("importApkg", () => {
		it("imports basic cards and returns correct count", async () => {
			const model = createAnkiModel();
			const deck = createAnkiDeck({ id: 1, name: "TestDeck" });
			const note1 = createAnkiNote({ id: 1, mid: model.id, flds: "Q1\x1fA1" });
			const note2 = createAnkiNote({ id: 2, mid: model.id, flds: "Q2\x1fA2" });
			const card1 = createAnkiCard({ id: 100, nid: 1, did: 1 });
			const card2 = createAnkiCard({ id: 101, nid: 2, did: 1 });

			mockParseApkg.mockResolvedValue(
				createApkgData({
					notes: [note1, note2],
					cards: [card1, card2],
					models: [model],
					decks: [deck],
				}),
			);

			const result = await service.importApkg(new ArrayBuffer(0), defaultOptions());

			expect(result.imported).toBe(2);
			expect(result.skipped).toBe(0);
			expect(result.duplicates).toBe(0);
			expect(result.errors).toHaveLength(0);
		});

		it("skips cards with empty question", async () => {
			const model = createAnkiModel();
			const deck = createAnkiDeck({ id: 1 });
			const note = createAnkiNote({ id: 1, mid: model.id, flds: "\x1fSome answer" });
			const card = createAnkiCard({ id: 100, nid: 1, did: 1 });

			mockParseApkg.mockResolvedValue(
				createApkgData({
					notes: [note],
					cards: [card],
					models: [model],
					decks: [deck],
				}),
			);

			const result = await service.importApkg(new ArrayBuffer(0), defaultOptions());

			expect(result.skipped).toBe(1);
			expect(result.imported).toBe(0);
		});

		it("detects duplicates", async () => {
			const model = createAnkiModel();
			const deck = createAnkiDeck({ id: 1 });
			const note = createAnkiNote({ id: 1, mid: model.id, flds: "Existing Q\x1fA" });
			const card = createAnkiCard({ id: 100, nid: 1, did: 1 });

			store.cards.getCardIdByQuestion.mockReturnValue("existing-card-id");

			mockParseApkg.mockResolvedValue(
				createApkgData({
					notes: [note],
					cards: [card],
					models: [model],
					decks: [deck],
				}),
			);

			const result = await service.importApkg(new ArrayBuffer(0), defaultOptions());

			expect(result.duplicates).toBe(1);
			expect(result.imported).toBe(0);
		});

		it("saves card via store.set", async () => {
			const model = createAnkiModel();
			const deck = createAnkiDeck({ id: 1 });
			const note = createAnkiNote({ id: 1, mid: model.id, flds: "Question\x1fAnswer" });
			const card = createAnkiCard({ id: 100, nid: 1, did: 1 });

			mockParseApkg.mockResolvedValue(
				createApkgData({
					notes: [note],
					cards: [card],
					models: [model],
					decks: [deck],
				}),
			);

			await service.importApkg(new ArrayBuffer(0), defaultOptions());

			expect(store.set).toHaveBeenCalledTimes(1);
			const [cardId, cardData] = store.set.mock.calls[0];
			expect(typeof cardId).toBe("string");
			expect(cardData.question).toBe("Question");
			expect(cardData.answer).toBe("Answer");
			expect(cardData.cardType).toBe("basic");
		});

		it("sets cloze fields for cloze cards", async () => {
			const model = createClozeModel();
			const deck = createAnkiDeck({ id: 1 });
			const note = createAnkiNote({
				id: 1,
				mid: model.id,
				flds: "{{c1::Paris}} is the capital\x1f",
			});
			const card = createAnkiCard({ id: 100, nid: 1, did: 1, ord: 0 });

			mockParseApkg.mockResolvedValue(
				createApkgData({
					notes: [note],
					cards: [card],
					models: [model],
					decks: [deck],
				}),
			);

			await service.importApkg(new ArrayBuffer(0), defaultOptions());

			expect(store.set).toHaveBeenCalledTimes(1);
			const [, cardData] = store.set.mock.calls[0];
			expect(cardData.cardType).toBe("cloze");
			expect(cardData.clozeTemplate).toBe("{{c1::Paris}} is the capital");
			expect(cardData.clozeIndex).toBe(1);
		});

		it("sets reverseOf for reversed cards", async () => {
			const model = createReversedModel();
			const deck = createAnkiDeck({ id: 1 });
			const note = createAnkiNote({
				id: 1,
				mid: model.id,
				flds: "Front text\x1fBack text",
			});
			const basicCard = createAnkiCard({ id: 200, nid: 1, did: 1, ord: 0 });
			const reversedCard = createAnkiCard({ id: 201, nid: 1, did: 1, ord: 1 });

			mockParseApkg.mockResolvedValue(
				createApkgData({
					notes: [note],
					cards: [basicCard, reversedCard],
					models: [model],
					decks: [deck],
				}),
			);

			await service.importApkg(new ArrayBuffer(0), defaultOptions());

			expect(store.set).toHaveBeenCalledTimes(2);

			// The basic card is set first; its ID becomes the reverseOf for the reversed card
			const [basicId] = store.set.mock.calls[0];
			const [, reversedData] = store.set.mock.calls[1];

			expect(reversedData.cardType).toBe("reversed");
			expect(reversedData.reverseOf).toBe(basicId);
		});

		it("notifies card change after import", async () => {
			const model = createAnkiModel();
			const deck = createAnkiDeck({ id: 1 });
			const note = createAnkiNote({ id: 1, mid: model.id, flds: "Q\x1fA" });
			const card = createAnkiCard({ id: 100, nid: 1, did: 1 });

			mockParseApkg.mockResolvedValue(
				createApkgData({
					notes: [note],
					cards: [card],
					models: [model],
					decks: [deck],
				}),
			);

			await service.importApkg(new ArrayBuffer(0), defaultOptions());

			expect(mockNotifyCardChange).toHaveBeenCalledTimes(1);
			expect(mockNotifyCardChange).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "bulk",
					action: "added",
				}),
			);
		});

		it("does not notify when no cards imported", async () => {
			const model = createAnkiModel();
			const deck = createAnkiDeck({ id: 1 });
			const note = createAnkiNote({ id: 1, mid: model.id, flds: "Q\x1fA" });
			const card = createAnkiCard({ id: 100, nid: 1, did: 1 });

			store.cards.getCardIdByQuestion.mockReturnValue("existing-id");

			mockParseApkg.mockResolvedValue(
				createApkgData({
					notes: [note],
					cards: [card],
					models: [model],
					decks: [deck],
				}),
			);

			await service.importApkg(new ArrayBuffer(0), defaultOptions());

			expect(mockNotifyCardChange).not.toHaveBeenCalled();
		});

		it("calls store.flush", async () => {
			const model = createAnkiModel();
			const deck = createAnkiDeck({ id: 1 });
			const note = createAnkiNote({ id: 1, mid: model.id, flds: "Q\x1fA" });
			const card = createAnkiCard({ id: 100, nid: 1, did: 1 });

			mockParseApkg.mockResolvedValue(
				createApkgData({
					notes: [note],
					cards: [card],
					models: [model],
					decks: [deck],
				}),
			);

			await service.importApkg(new ArrayBuffer(0), defaultOptions());

			expect(store.flush).toHaveBeenCalledTimes(2);
		});

		it("handles error in single card without aborting", async () => {
			const model = createAnkiModel();
			const deck = createAnkiDeck({ id: 1 });
			const note1 = createAnkiNote({ id: 1, mid: model.id, flds: "Q1\x1fA1" });
			const note2 = createAnkiNote({ id: 2, mid: model.id, flds: "Q2\x1fA2" });
			const card1 = createAnkiCard({ id: 100, nid: 1, did: 1 });
			const card2 = createAnkiCard({ id: 101, nid: 2, did: 1 });

			// First store.set call throws, second succeeds
			store.set
				.mockImplementationOnce(() => {
					throw new Error("DB write failed");
				})
				.mockImplementation(() => {});

			mockParseApkg.mockResolvedValue(
				createApkgData({
					notes: [note1, note2],
					cards: [card1, card2],
					models: [model],
					decks: [deck],
				}),
			);

			const result = await service.importApkg(new ArrayBuffer(0), defaultOptions());

			expect(result.imported).toBe(1);
			expect(result.skipped).toBe(1);
			expect(result.errors.length).toBeGreaterThan(0);
			expect(result.errors[0]).toContain("DB write failed");
		});

		it("returns empty result with error when no cards found", async () => {
			mockParseApkg.mockResolvedValue(
				createApkgData({ notes: [], cards: [], models: [], decks: [] }),
			);

			const result = await service.importApkg(new ArrayBuffer(0), defaultOptions());

			expect(result.imported).toBe(0);
			expect(result.errors).toContain("No cards found in the .apkg file");
		});

	});
});
