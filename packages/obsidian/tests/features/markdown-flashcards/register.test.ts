import { TFile } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DomainEventBus } from "@true-recall/core/events/event-bus";
import { parseMarkdownCards } from "@true-recall/core/flashcard/markdown/parser";
import { DEFAULT_MARKDOWN_FLASHCARDS } from "@true-recall/core/flashcard/markdown/settings";

import {
	createTestContext,
	type TestContext,
} from "../../../../core/tests/persistence/sqlite/__setup__/test-database";
import {
	isMarkdownFlashcardNote,
	registerMarkdownFlashcards,
} from "../../../src/features/markdown-flashcards/register";

const mocks = vi.hoisted(() => ({
	error: vi.fn(),
	yaml: vi.fn(),
	changed: undefined as undefined | (() => void),
}));
vi.mock("obsidian", async (original) => ({
	...(await original<object>()),
	parseYaml: mocks.yaml,
}));
vi.mock("@true-recall/obsidian/services/notification.service", () => ({
	notify: () => ({ error: mocks.error }),
}));
vi.mock("@true-recall/obsidian/data/use-data", () => ({
	getDataLayer: () => ({
		signal: () => ({
			subscribe: (fn: () => void) => {
				mocks.changed = fn;
				return () => {
					mocks.changed = undefined;
				};
			},
		}),
	}),
}));

describe("Markdown vault integration", () => {
	let ctx: TestContext;
	let content: string;
	let file: TFile;
	let failWrite: boolean;
	let controller: ReturnType<typeof registerMarkdownFlashcards> | undefined;
	let beforeWrite: (() => void) | undefined;
	let afterWrite: (() => void) | undefined;
	let process: ReturnType<typeof vi.fn>;
	let events: DomainEventBus;
	let cleanup: (() => void)[];
	let changes: Map<string, (file: TFile) => void>;
	let settings: { markdownFlashcards: typeof DEFAULT_MARKDOWN_FLASHCARDS };
	const settle = async () => {
		for (let i = 0; i < 3; i++) {
			await vi.advanceTimersByTimeAsync(1000);
			await controller?.whenIdle();
		}
	};
	beforeEach(async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-09-22T08:00:00Z"));
		mocks.error.mockClear();
		mocks.yaml.mockReset();
		ctx = await createTestContext();
		events = new DomainEventBus();
		file = Object.assign(new TFile(), { path: "Cards.md", extension: "md" });
		content = "#flashcards\n\nQ1\n??\nA1\n\nQ2\n???\nA2\n";
		failWrite = false;
		controller = undefined;
		beforeWrite = undefined;
		afterWrite = undefined;
		changes = new Map();
		cleanup = [];
		settings = {
			markdownFlashcards: {
				...DEFAULT_MARKDOWN_FLASHCARDS,
				enabled: true,
				storeScheduling: true,
			},
		};
		process = vi.fn(async (_file: TFile, fn: (text: string) => string) => {
			if (failWrite) throw new Error("Disk full");
			const before = beforeWrite;
			beforeWrite = undefined;
			before?.();
			const next = fn(content);
			if (next !== content) {
				content = next;
				changes.get("modify")?.(file);
			}
			const after = afterWrite;
			afterWrite = undefined;
			after?.();
			return next;
		});
	});
	afterEach(() => {
		for (const fn of cleanup.reverse()) fn();
		ctx.close();
		vi.useRealTimers();
	});
	const start = () => {
		controller = registerMarkdownFlashcards({
			app: {
				vault: {
					getAbstractFileByPath: (path: string) =>
						path === file.path ? file : null,
					read: async () => content,
					process,
					getMarkdownFiles: () => [file],
					on: (event: string, fn: (file: TFile) => void) => {
						changes.set(event, fn);
						return {};
					},
				},
				workspace: { onLayoutReady: (fn: () => void) => fn() },
			},
			settings,
			cardStore: {
				getDeviceId: () => "test-device",
				cards: ctx.cards,
				notes: ctx.notes,
				transaction: (fn: () => unknown) => ctx.db.transaction(fn),
			},
			flashcardManager: {
				getSourceNoteService: () => ({
					getOrCreateSourceUid: async () => "source-a",
					findSourceNoteByUid: () => file.path,
				}),
			},
			coreApp: { events },
			register: (fn: () => void) => cleanup.push(fn),
			registerEvent: vi.fn(),
			addCommand: vi.fn(),
		} as never);
	};
	it("persists unique IDs, imports once and does not loop on its own writes", async () => {
		start();
		await settle();
		expect(ctx.cards.size()).toBe(3);
		const cards = parseMarkdownCards(content, settings.markdownFlashcards);
		expect(new Set(cards.map((card) => card.marker?.id)).size).toBe(2);
		expect(cards.map((card) => card.front)).toEqual(["Q1", "Q2"]);
		expect(cards[0]?.marker?.schedules?.[0]?.reps).toBe(0);
		const writes = process.mock.calls.length;
		await vi.advanceTimersByTimeAsync(10000);
		expect(process).toHaveBeenCalledTimes(writes);
		expect(mocks.error).not.toHaveBeenCalled();
	});
	it("does not create cards when marker persistence fails", async () => {
		failWrite = true;
		start();
		await settle();
		expect(ctx.cards.size()).toBe(0);
		expect(mocks.error).toHaveBeenCalledWith(
			expect.stringContaining("Disk full"),
		);
	});
	it("exports a review and UI-only bulk scheduling changes without losing text", async () => {
		start();
		await settle();
		const card = ctx.cards.getAll()[0];
		if (!card) throw new Error("Missing card");
		vi.advanceTimersByTime(1000);
		ctx.cards.set(card.id, { ...card, reps: 4, stability: 10 });
		events.emit("card:reviewed", { cardId: card.id, rating: 3, newState: 2 });
		await settle();
		expect(content).toContain('"reps":4');
		expect(content).toContain("Q1\n??\nA1");
		vi.advanceTimersByTime(1000);
		ctx.cards.bulkSuspend([card.id]);
		mocks.changed?.();
		await settle();
		expect(content).toContain('"suspended":true');
	});
	it("keeps cards after tag removal, disabling, and a file rename", async () => {
		start();
		await settle();
		const ids = ctx.cards.keys();
		file.path = "Renamed.md";
		changes.get("rename")?.(file);
		await settle();
		expect(ctx.cards.keys()).toEqual(ids);
		content = content.replace("#flashcards", "#other");
		changes.get("modify")?.(file);
		await settle();
		expect(ctx.cards.keys()).toEqual(ids);
		settings.markdownFlashcards.enabled = false;
		content = "#flashcards\n\nOther\n??\nAnswer";
		changes.get("modify")?.(file);
		await settle();
		expect(ctx.cards.keys()).toEqual(ids);
	});
	it("does not reset cards for incomplete edits and stops queued writes on unload", async () => {
		start();
		await settle();
		const ids = ctx.cards.keys();
		content = "#flashcards\n\nQ\n??";
		changes.get("modify")?.(file);
		await settle();
		expect(ctx.cards.keys()).toEqual(ids);
		expect(mocks.error).toHaveBeenCalledOnce();
		content = "#flashcards\n\nNew\n??\nAnswer";
		changes.get("modify")?.(file);
		for (const fn of cleanup.reverse()) fn();
		cleanup = [];
		await settle();
		expect(ctx.cards.keys()).toEqual(ids);
	});
	const editPanel = (id: string, front: string, back: string) => {
		ctx.cards.updateCardContent(id, front, back);
		events.emit("card:updated", {
			cardId: id,
			changes: { question: true, answer: true },
		});
	};
	const firstCard = () => {
		const card = ctx.cards.getAll().find((card) => card.question === "Q1");
		if (!card) throw new Error("Missing first card");
		return card;
	};
	it.each([
		false,
		true,
	])("syncs panel edits and undo with scheduling export %s, preserving IDs and progress", async (storeScheduling) => {
		settings.markdownFlashcards.storeScheduling = storeScheduling;
		start();
		await settle();
		const original = firstCard();
		const ids = ctx.cards.keys();
		ctx.cards.set(original.id, { ...original, reps: 12, stability: 34 });
		editPanel(original.id, "Panel question", "Panel answer");
		await settle();
		expect(content).toContain("Panel question\n??\nPanel answer");
		expect(ctx.cards.get(original.id)).toMatchObject({
			reps: 12,
			stability: 34,
		});
		expect(ctx.cards.keys()).toEqual(ids);
		editPanel(original.id, "Q1", "A1");
		await settle();
		expect(content).toContain("Q1\n??\nA1");
		expect(ctx.cards.get(original.id)?.reps).toBe(12);
		expect(mocks.error).not.toHaveBeenCalled();
	});
	it("writes edits of the reversed sibling in source-note orientation", async () => {
		start();
		await settle();
		const reversed = ctx.cards.getAll().find((card) => card.templateOrd === 1);
		if (!reversed) throw new Error("Missing reversed card");
		const ids = ctx.cards.keys();
		editPanel(reversed.id, "New back", "New front");
		await settle();
		expect(content).toContain("New front\n???\nNew back");
		expect(ctx.cards.get(reversed.id)).toMatchObject({
			question: "New back",
			answer: "New front",
		});
		expect(ctx.cards.keys()).toEqual(ids);
	});
	it("combines changes to different fields and preserves unrelated prose and other cards", async () => {
		content = `# Heading\n\n${content}\nOther prose.\n`;
		start();
		await settle();
		const original = firstCard();
		const other = content.slice(content.indexOf("Q2"));
		content = content.replace("\nA1\n", "\nFile answer\n");
		changes.get("modify")?.(file);
		editPanel(original.id, "Panel question", "A1");
		await settle();
		expect(content).toContain("Panel question\n??\nFile answer");
		expect(content).toContain("# Heading");
		expect(content.slice(content.indexOf("Q2"))).toBe(other);
		expect(ctx.cards.get(original.id)).toMatchObject({
			question: "Panel question",
			answer: "File answer",
		});
		expect(mocks.error).not.toHaveBeenCalled();
	});
	it("keeps conflicting versions across restart and resumes after matching the field", async () => {
		start();
		await settle();
		const original = firstCard();
		content = content.replace("Q1", "File question");
		changes.get("modify")?.(file);
		editPanel(original.id, "Panel question", "A1");
		await settle();
		expect(content).toContain("File question");
		expect(ctx.cards.get(original.id)?.question).toBe("Panel question");
		expect(mocks.error).toHaveBeenCalledWith(
			expect.stringContaining("Sync conflict in question"),
		);
		for (const fn of cleanup.reverse()) fn();
		cleanup = [];
		start();
		await settle();
		expect(content).toContain("File question");
		expect(ctx.cards.get(original.id)?.question).toBe("Panel question");
		editPanel(original.id, "File question", "A1");
		await settle();
		content = content.replace("File question", "Resolved question");
		changes.get("modify")?.(file);
		await settle();
		expect(ctx.cards.get(original.id)?.question).toBe("Resolved question");
	});
	it("retains panel edits after a failed file write and retries safely on restart", async () => {
		start();
		await settle();
		const original = firstCard();
		const previous = content;
		failWrite = true;
		editPanel(original.id, "Panel question", "A1");
		await settle();
		expect(content).toBe(previous);
		expect(ctx.cards.get(original.id)?.question).toBe("Panel question");
		for (const fn of cleanup.reverse()) fn();
		cleanup = [];
		failWrite = false;
		start();
		await settle();
		expect(content).toContain("Panel question\n??\nA1");
		expect(ctx.cards.get(original.id)?.question).toBe("Panel question");
	});
	it("retries when the file changes between planning and its atomic write", async () => {
		start();
		await settle();
		const original = firstCard();
		beforeWrite = () => {
			content = content.replace("\nA1\n", "\nExternal answer\n");
		};
		editPanel(original.id, "Panel question", "A1");
		await settle();
		expect(content).toContain("Panel question\n??\nExternal answer");
		expect(ctx.cards.get(original.id)).toMatchObject({
			question: "Panel question",
			answer: "External answer",
		});
	});
	it("does not import stale content over a panel edit made during the file write", async () => {
		start();
		await settle();
		const original = firstCard();
		afterWrite = () => editPanel(original.id, "Newer question", "A1");
		editPanel(original.id, "First question", "A1");
		await settle();
		expect(ctx.cards.get(original.id)?.question).toBe("Newer question");
		expect(content).toContain("First question");
		expect(mocks.error).toHaveBeenCalledWith(
			expect.stringContaining("Sync conflict"),
		);
	});
	it("detects raw UI note changes that do not update card timestamps", async () => {
		settings.markdownFlashcards.storeScheduling = false;
		start();
		await settle();
		const original = firstCard();
		vi.advanceTimersByTime(1000);
		ctx.cards.updateCardContent(original.id, "Bulk edit", "A1");
		mocks.changed?.();
		await settle();
		expect(content).toContain("Bulk edit\n??\nA1");
	});
	it("keeps unrepresentable panel content instead of damaging card boundaries", async () => {
		start();
		await settle();
		const original = firstCard();
		const previous = content;
		editPanel(original.id, "Q1", "First paragraph\n\nSecond paragraph");
		await settle();
		expect(content).toBe(previous);
		expect(ctx.cards.get(original.id)?.answer).toBe(
			"First paragraph\n\nSecond paragraph",
		);
		expect(mocks.error).toHaveBeenCalledWith(
			expect.stringContaining("panel edit"),
		);
	});

	it("ignores code examples and tag prefixes and accepts frontmatter tags", () => {
		expect(isMarkdownFlashcardNote("```\n#flashcards\n```", "flashcards")).toBe(
			false,
		);
		expect(isMarkdownFlashcardNote("#flashcards-other", "flashcards")).toBe(
			false,
		);
		mocks.yaml.mockReturnValue({ tags: ["flashcards"] });
		expect(
			isMarkdownFlashcardNote(
				"---\ntags: [flashcards]\n---\nQ\n??\nA",
				"flashcards",
			),
		).toBe(true);
	});
});
