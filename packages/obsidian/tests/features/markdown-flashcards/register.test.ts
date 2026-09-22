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
	let process: ReturnType<typeof vi.fn>;
	let events: DomainEventBus;
	let cleanup: (() => void)[];
	let changes: Map<string, (file: TFile) => void>;
	let settings: { markdownFlashcards: typeof DEFAULT_MARKDOWN_FLASHCARDS };
	const settle = async () => {
		await vi.advanceTimersByTimeAsync(2000);
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
			const next = fn(content);
			if (next !== content) {
				content = next;
				changes.get("modify")?.(file);
			}
			return content;
		});
	});
	afterEach(() => {
		for (const fn of cleanup.reverse()) fn();
		ctx.close();
		vi.useRealTimers();
	});
	const start = () => {
		registerMarkdownFlashcards({
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
