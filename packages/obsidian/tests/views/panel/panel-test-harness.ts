import { Platform, TFile } from "obsidian";
import { vi } from "vitest";

import type { FlashcardInfo, FlashcardItem } from "@true-recall/core/types";
import {
	BUILTIN_BASIC_ID,
	type NoteType,
} from "@true-recall/core/types/note.types";

import { createMockCard, createTestStore } from "../../store/test-helpers";

const BASIC_TYPE: NoteType = {
	id: BUILTIN_BASIC_ID,
	name: "Basic",
	type: 0,
	fields: ["Front", "Back"],
	templates: [
		{ name: "Card 1", ordinal: 0, qfmt: "{{Front}}", afmt: "{{Back}}" },
	],
	css: "",
	isBuiltin: true,
	slug: "basic",
};

/** One uncollected basic block in note markdown. */
export const BASIC_BLOCK = "#type/basic\nFront: Q\nBack: A";

export interface Deferred<T> {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (error: unknown) => void;
}

export function createDeferred<T>(): Deferred<T> {
	let resolve!: (value: T) => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

export function createMockFile(path: string): TFile {
	const name = path.split("/").pop() ?? path;
	const dot = name.lastIndexOf(".");
	return Object.assign(new TFile(), {
		path,
		name,
		basename: dot > 0 ? name.slice(0, dot) : name,
		extension: dot > 0 ? name.slice(dot + 1) : "",
	});
}

export function createMockFlashcardInfo(
	cards: Array<Partial<FlashcardItem>>,
): FlashcardInfo {
	const flashcards = cards.map((card, index) => ({
		id: `card-${index}`,
		question: `Question ${index}`,
		answer: `Answer ${index}`,
		...card,
	}));
	return {
		exists: flashcards.length > 0,
		cardCount: flashcards.length,
		questions: flashcards.map((card) => card.question),
		flashcards,
		lastModified: null,
	};
}

/**
 * In-memory stand-in for the Obsidian app, the plugin, and the flashcard
 * manager as seen by the flashcard panel. Loads resolve immediately unless a
 * test holds them with `holdInfo(path)`.
 */
export function createPanelHarness(
	options: {
		files?: Record<string, string>;
		info?: Record<string, FlashcardInfo>;
		activePath?: string | null;
		lastOpen?: string[];
	} = {},
) {
	const store = createTestStore();
	const files = new Map<string, TFile>();
	const contents = new Map<string, string>();
	for (const [path, content] of Object.entries(options.files ?? {})) {
		files.set(path, createMockFile(path));
		contents.set(path, content);
	}
	const info = new Map(Object.entries(options.info ?? {}));
	const heldInfo = new Map<string, Deferred<FlashcardInfo | null>>();
	let activePath = options.activePath ?? null;

	const vault = {
		getAbstractFileByPath: vi.fn((path: string) => files.get(path) ?? null),
		read: vi.fn(async (file: TFile) => {
			const content = contents.get(file.path);
			if (content === undefined) throw new Error(`missing ${file.path}`);
			return content;
		}),
	};
	const workspace = {
		getActiveFile: vi.fn(() =>
			activePath ? (files.get(activePath) ?? null) : null,
		),
		getLastOpenFiles: vi.fn(() => options.lastOpen ?? []),
		on: vi.fn((_name: string, callback: () => void) => ({ callback })),
		openLinkText: vi.fn().mockResolvedValue(undefined),
	};
	const flashcardManager = {
		hasStore: vi.fn(() => true),
		getFlashcardInfo: vi.fn(async (path: string) => {
			const held = heldInfo.get(path);
			if (held) {
				heldInfo.delete(path);
				return held.promise;
			}
			return info.get(path) ?? createMockFlashcardInfo([]);
		}),
	};
	const commandService = {
		execute: vi.fn(
			async (cmd: { cardIds?: string[]; deletedCount: number }) => {
				cmd.deletedCount = cmd.cardIds?.length ?? 0;
			},
		),
		undo: vi.fn().mockResolvedValue(undefined),
	};
	const plugin = {
		store,
		flashcardManager,
		commandService,
		noteTypeService: {
			getBySlug: (slug: string) => (slug === "basic" ? BASIC_TYPE : null),
		},
		cardStore: { notes: { getById: () => null } },
		reviewNoteFlashcards: vi.fn(),
	};
	const app = { vault, workspace };

	return {
		app,
		plugin,
		store,
		vault,
		workspace,
		flashcardManager,
		commandService,
		get panel() {
			return store.getState().panel;
		},
		setActive(path: string | null) {
			activePath = path;
		},
		addFile(path: string, content: string) {
			files.set(path, createMockFile(path));
			contents.set(path, content);
			return files.get(path) as TFile;
		},
		removeFile(path: string) {
			files.delete(path);
			contents.delete(path);
		},
		file(path: string): TFile {
			const file = files.get(path);
			if (!file) throw new Error(`unknown file ${path}`);
			return file;
		},
		setInfo(path: string, value: FlashcardInfo) {
			info.set(path, value);
		},
		holdInfo(path: string) {
			const deferred = createDeferred<FlashcardInfo | null>();
			heldInfo.set(path, deferred);
			return deferred;
		},
		startReview(sourceNotePaths: Array<string | undefined>) {
			const cards = sourceNotePaths.map((sourceNotePath, index) =>
				createMockCard({ id: `review-${index}`, sourceNotePath }),
			);
			store.getState().review.startSession(cards);
		},
		endReview() {
			store.getState().review.endSession();
		},
	};
}

export type PanelHarness = ReturnType<typeof createPanelHarness>;

export function setMobile(isMobile: boolean): void {
	(Platform as { isMobile: boolean }).isMobile = isMobile;
	(Platform as { isDesktop: boolean }).isDesktop = !isMobile;
}

/** Let chained promise callbacks run without advancing fake timers. */
export async function flushPromises(rounds = 5): Promise<void> {
	for (let i = 0; i < rounds; i++) await Promise.resolve();
}
