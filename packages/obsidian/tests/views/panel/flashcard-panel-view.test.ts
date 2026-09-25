import { ItemView, type WorkspaceLeaf } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DataLayer, Q, setDataLayer } from "@true-recall/obsidian/data";
import { setLastMutation } from "@true-recall/obsidian/services/signals";
import { FlashcardPanelView } from "@true-recall/obsidian/views/panel/FlashcardPanelView";

import {
	BASIC_BLOCK,
	createMockFlashcardInfo,
	createPanelHarness,
	flushPromises,
	type PanelHarness,
	setMobile,
} from "./panel-test-harness";

const notifications = vi.hoisted(() => ({
	success: vi.fn(),
	warning: vi.fn(),
	cardsDeletedWithUndo: vi.fn(),
}));
const confirmMock = vi.hoisted(() => vi.fn());

vi.mock("@true-recall/obsidian/preact/mount", () => ({
	mountPreact: vi.fn(() => vi.fn()),
}));
vi.mock("@true-recall/obsidian/services/notification.service", () => ({
	notify: () => notifications,
}));
vi.mock("@true-recall/obsidian/modals/shared/ConfirmModal", () => ({
	confirm: confirmMock,
}));

class FakeElement {
	empty(): void {}
}

type Listener = () => void;

// The Obsidian mock's ItemView is empty; give it the parts the panel uses.
// `registerEvent` collects listeners that `unload()` drops, mirroring
// Obsidian's View.close(): detach, unload, then onClose.
Object.assign(ItemView.prototype, {
	getState() {
		return {};
	},
	async setState() {},
	onPaneMenu() {},
	registerEvent(this: { _events?: unknown[] }, ref: unknown) {
		this._events ??= [];
		this._events.push(ref);
	},
	addAction(this: { _actions?: string[] }, icon: string) {
		this._actions ??= [];
		this._actions.push(icon);
		const el = {
			remove: () => {
				this._actions = this._actions?.filter((item) => item !== icon);
			},
		};
		return el;
	},
});

interface TestView extends FlashcardPanelView {
	_events?: Array<{ callback: Listener }>;
	_actions?: string[];
}

let dataLayer: DataLayer;
let metaVersion = 0;

function createView(h: PanelHarness): TestView {
	const leaf = {} as WorkspaceLeaf;
	const view = new FlashcardPanelView(leaf, h.plugin as never) as TestView;
	Object.assign(view, {
		app: h.app,
		containerEl: { children: [null, new FakeElement()] },
	});
	return view;
}

async function openView(h: PanelHarness): Promise<TestView> {
	const view = createView(h);
	await view.onOpen();
	// Opening schedules an initial data-driven reload; let it settle.
	await vi.advanceTimersByTimeAsync(150);
	return view;
}

async function closeView(view: TestView): Promise<void> {
	view._events = [];
	await view.onClose();
}

function fireEditorChange(view: TestView): void {
	for (const ref of view._events ?? []) ref.callback();
}

function bumpAllMeta(): void {
	dataLayer.invalidateGroups(["cards"]);
}

async function settle(ms = 150): Promise<void> {
	await flushPromises();
	await vi.advanceTimersByTimeAsync(ms);
}

beforeEach(() => {
	vi.stubGlobal("HTMLElement", FakeElement);
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-09-25T10:00:00Z"));
	setMobile(false);
	confirmMock.mockReset();
	for (const fn of Object.values(notifications)) fn.mockReset();
	dataLayer = new DataLayer();
	metaVersion = 0;
	dataLayer.register(Q.ALL_META, () => new Map([["v", ++metaVersion]]), [
		"cards",
	]);
	dataLayer.register(Q.SETTINGS, () => ({}), ["settings"]);
	setDataLayer(dataLayer);
});

afterEach(() => {
	setMobile(false);
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

const NOTE_A = "notes/a.md";
const NOTE_B = "notes/b.md";

function twoNotes(overrides: Parameters<typeof createPanelHarness>[0] = {}) {
	return createPanelHarness({
		files: {
			[NOTE_A]: "# A\n==highlight==",
			[NOTE_B]: "# B",
			"images/pic.png": "",
		},
		info: {
			[NOTE_A]: createMockFlashcardInfo([{ id: "a1" }, { id: "a2" }]),
			[NOTE_B]: createMockFlashcardInfo([{ id: "b1" }]),
		},
		activePath: NOTE_A,
		...overrides,
	});
}

describe("FlashcardPanelView source selection", () => {
	it("loads the active note on open", async () => {
		const h = twoNotes();
		await openView(h);
		expect(h.panel.currentFile?.path).toBe(NOTE_A);
		expect(h.panel.status).toBe("exists");
		expect(h.panel.flashcardInfo?.cardCount).toBe(2);
		expect(h.panel.hasHighlights).toBe(true);
		expect(h.panel.isFollowingReview).toBe(false);
	});

	it("follows the current review card when a session is already active", async () => {
		const h = twoNotes();
		h.startReview([NOTE_B]);
		await openView(h);
		expect(h.panel.currentFile?.path).toBe(NOTE_B);
		expect(h.panel.isFollowingReview).toBe(true);
		expect(h.panel.reviewSourceNotePath).toBe(NOTE_B);
	});

	it("switches to the review source when a session starts and back when it ends", async () => {
		const h = twoNotes();
		await openView(h);

		h.startReview([NOTE_B]);
		await settle();
		expect(h.panel.currentFile?.path).toBe(NOTE_B);
		expect(h.panel.isFollowingReview).toBe(true);

		h.endReview();
		await settle();
		expect(h.panel.currentFile?.path).toBe(NOTE_A);
		expect(h.panel.isFollowingReview).toBe(false);
	});

	it("moves with the review when the next card has another source", async () => {
		const h = twoNotes();
		h.setActive(null);
		await openView(h);
		h.startReview([NOTE_A, NOTE_B]);
		await settle();
		expect(h.panel.currentFile?.path).toBe(NOTE_A);

		h.store.setState((s) => ({ review: { ...s.review, currentIndex: 1 } }));
		await settle();
		expect(h.panel.currentFile?.path).toBe(NOTE_B);
	});

	it("shows the active note for a review card without a source", async () => {
		const h = twoNotes();
		h.setActive(NOTE_B);
		await openView(h);
		h.startReview([undefined]);
		await settle();
		expect(h.panel.currentFile?.path).toBe(NOTE_B);
		expect(h.panel.isFollowingReview).toBe(false);
	});

	// Regression: fixed after the refactor (see REFACTORING.md).
	it("keeps the panel on the active note when the review source was deleted", async () => {
		const h = twoNotes();
		await openView(h);
		h.startReview(["notes/deleted.md"]);
		await settle();
		expect(h.panel.currentFile?.path).toBe(NOTE_A);
		expect(h.panel.isFollowingReview).toBe(false);
		expect(h.panel.flashcardInfo?.cardCount).toBe(2);
	});

	it("clears the panel for a note deleted after it was selected", async () => {
		const h = twoNotes();
		await openView(h);
		h.removeFile(NOTE_A);
		bumpAllMeta();
		await settle();
		expect(h.panel.flashcardInfo).toBeNull();
		expect(h.panel.status).toBe("none");
		expect(h.panel.uncollectedCount).toBe(0);
	});

	it("clears the info for a non-markdown file", async () => {
		const h = twoNotes();
		const view = await openView(h);
		await view.handleFileChange(h.file("images/pic.png"));
		expect(h.panel.currentFile?.path).toBe("images/pic.png");
		expect(h.panel.flashcardInfo).toBeNull();
		expect(h.panel.status).toBe("none");
	});

	it("does not reload when the same file is selected again", async () => {
		const h = twoNotes();
		const view = await openView(h);
		const calls = h.flashcardManager.getFlashcardInfo.mock.calls.length;
		await view.handleFileChange(h.file(NOTE_A));
		expect(h.flashcardManager.getFlashcardInfo.mock.calls.length).toBe(calls);
	});

	it("re-syncs with the review through syncWithReviewState", async () => {
		const h = twoNotes();
		const view = await openView(h);
		h.startReview([NOTE_B]);
		await settle();
		view.clearReviewFollowState();
		await view.handleFileChange(h.file(NOTE_A));
		expect(view.isFollowingReview()).toBe(false);

		view.syncWithReviewState(NOTE_B, true);
		await settle();
		expect(h.panel.currentFile?.path).toBe(NOTE_B);
		expect(view.isFollowingReview()).toBe(true);
	});
});

describe("FlashcardPanelView view state restore", () => {
	it("prefers the restored note over the active note on open", async () => {
		const h = twoNotes();
		const view = createView(h);
		await view.setState({ file: NOTE_B }, {} as never);
		await view.onOpen();
		await settle();
		expect(h.panel.currentFile?.path).toBe(NOTE_B);
	});

	it("applies a restored note that arrives after open", async () => {
		const h = twoNotes();
		const view = await openView(h);
		await view.setState({ file: NOTE_B }, {} as never);
		await settle();
		expect(h.panel.currentFile?.path).toBe(NOTE_B);
		expect(view.getState()).toEqual({ file: NOTE_B });
	});

	// Regression: fixed after the refactor (see REFACTORING.md).
	it("does not let a late restored note replace the review source", async () => {
		const h = twoNotes();
		h.startReview([NOTE_B]);
		const view = await openView(h);
		await view.setState({ file: NOTE_A }, {} as never);
		await settle();
		expect(h.panel.currentFile?.path).toBe(NOTE_B);
		expect(h.panel.isFollowingReview).toBe(true);
	});

	it("falls back to the last opened markdown file on mobile", async () => {
		setMobile(true);
		const h = twoNotes({
			activePath: null,
			lastOpen: ["images/pic.png", NOTE_B, NOTE_A],
		});
		await openView(h);
		expect(h.panel.currentFile?.path).toBe(NOTE_B);
	});

	it("opens empty on desktop without an active note", async () => {
		const h = twoNotes({ activePath: null, lastOpen: [NOTE_B] });
		await openView(h);
		expect(h.panel.currentFile).toBeNull();
	});
});

describe("FlashcardPanelView on mobile", () => {
	it("keeps the pinned note when the active tab is not a file", async () => {
		setMobile(true);
		const h = twoNotes();
		const view = await openView(h);
		await view.handleFileChange(null);
		expect(h.panel.currentFile?.path).toBe(NOTE_A);
		expect(h.panel.flashcardInfo?.cardCount).toBe(2);
	});

	it("keeps the pinned note after a review ends on a non-file tab", async () => {
		setMobile(true);
		const h = twoNotes({ activePath: null, lastOpen: [NOTE_A] });
		await openView(h);
		h.startReview([NOTE_B]);
		await settle();
		h.endReview();
		await settle();
		expect(h.panel.currentFile?.path).toBe(NOTE_B);
		expect(h.panel.isFollowingReview).toBe(false);
	});

	it("clears the panel on desktop when no file is active", async () => {
		const h = twoNotes();
		const view = await openView(h);
		await view.handleFileChange(null);
		expect(h.panel.currentFile).toBeNull();
		expect(h.panel.flashcardInfo).toBeNull();
	});
});

describe("FlashcardPanelView concurrent loads", () => {
	it("ignores an older result after switching A to B", async () => {
		const h = twoNotes();
		const view = await openView(h);
		h.setInfo(NOTE_A, createMockFlashcardInfo([{ id: "stale" }]));
		const heldA = h.holdInfo(NOTE_A);
		bumpAllMeta();
		await settle();

		await view.handleFileChange(h.file(NOTE_B));
		heldA.resolve(createMockFlashcardInfo([{ id: "stale" }]));
		await flushPromises();

		expect(h.panel.currentFile?.path).toBe(NOTE_B);
		expect(h.panel.flashcardInfo?.flashcards.map((c) => c.id)).toEqual(["b1"]);
	});

	// Regression: fixed after the refactor (see REFACTORING.md).
	it("ignores an older result after switching to a file without cards", async () => {
		const h = twoNotes();
		const view = await openView(h);
		const heldA = h.holdInfo(NOTE_A);
		bumpAllMeta();
		await settle();

		await view.handleFileChange(h.file("images/pic.png"));
		heldA.resolve(createMockFlashcardInfo([{ id: "stale" }]));
		await flushPromises();

		expect(h.panel.currentFile?.path).toBe("images/pic.png");
		expect(h.panel.flashcardInfo).toBeNull();
		expect(h.panel.status).toBe("none");
	});

	// Regression: fixed after the refactor (see REFACTORING.md).
	it("does not publish a result that arrives after close", async () => {
		const h = twoNotes();
		const view = await openView(h);
		const heldA = h.holdInfo(NOTE_A);
		bumpAllMeta();
		await settle();
		h.panel.setFlashcardInfo(null);

		await closeView(view);
		heldA.resolve(createMockFlashcardInfo([{ id: "late" }]));
		await flushPromises();

		expect(h.panel.flashcardInfo).toBeNull();
	});

	// Regression: fixed after the refactor (see REFACTORING.md).
	it("ignores an uncollected count read for a note that is no longer shown", async () => {
		const h = twoNotes();
		const view = await openView(h);
		let releaseRead: (() => void) | undefined;
		h.vault.read.mockImplementationOnce(
			(file) =>
				new Promise((resolve) => {
					releaseRead = () => resolve(`${BASIC_BLOCK}\n${file.path}`);
				}),
		);
		fireEditorChange(view);
		await vi.advanceTimersByTimeAsync(500);

		await view.handleFileChange(h.file(NOTE_B));
		releaseRead?.();
		await flushPromises();

		expect(h.panel.currentFile?.path).toBe(NOTE_B);
		expect(h.panel.uncollectedCount).toBe(0);
	});
});

describe("FlashcardPanelView refresh policy", () => {
	it("skips the content reload for an FSRS rating while following a review", async () => {
		const h = twoNotes();
		h.startReview([NOTE_B]);
		await openView(h);
		const calls = h.flashcardManager.getFlashcardInfo.mock.calls.length;

		setLastMutation({ type: "reviewed", cardId: "b1", rating: 3 });
		bumpAllMeta();
		await settle();

		expect(h.flashcardManager.getFlashcardInfo.mock.calls.length).toBe(calls);
	});

	it("reloads after a content update while following a review", async () => {
		const h = twoNotes();
		h.startReview([NOTE_B]);
		await openView(h);
		const calls = h.flashcardManager.getFlashcardInfo.mock.calls.length;

		setLastMutation({
			type: "updated",
			cardId: "b1",
			changes: { question: true },
		});
		await settle();

		expect(h.flashcardManager.getFlashcardInfo.mock.calls.length).toBe(
			calls + 1,
		);
	});

	it("reloads after an FSRS rating when not following a review", async () => {
		const h = twoNotes();
		await openView(h);
		const calls = h.flashcardManager.getFlashcardInfo.mock.calls.length;

		setLastMutation({ type: "reviewed", cardId: "a1", rating: 3 });
		bumpAllMeta();
		await settle();

		expect(h.flashcardManager.getFlashcardInfo.mock.calls.length).toBe(
			calls + 1,
		);
	});

	it("debounces bursts of data changes into one reload", async () => {
		const h = twoNotes();
		await openView(h);
		const calls = h.flashcardManager.getFlashcardInfo.mock.calls.length;

		setLastMutation({ type: "updated", cardId: "a1", changes: {} });
		bumpAllMeta();
		bumpAllMeta();
		await settle();

		expect(h.flashcardManager.getFlashcardInfo.mock.calls.length).toBe(
			calls + 1,
		);
	});

	it("updates the uncollected count after an editor change", async () => {
		const h = twoNotes();
		const view = await openView(h);
		h.addFile(NOTE_A, `${BASIC_BLOCK}\n\n==mark==`);

		fireEditorChange(view);
		await vi.advanceTimersByTimeAsync(499);
		expect(h.panel.uncollectedCount).toBe(0);
		await vi.advanceTimersByTimeAsync(1);
		await flushPromises();

		expect(h.panel.uncollectedCount).toBe(1);
	});
});

describe("FlashcardPanelView lifecycle", () => {
	it("stops reacting to data, review, and editor changes after close", async () => {
		const h = twoNotes();
		const view = await openView(h);
		// A debounced editor check is pending when the view closes.
		fireEditorChange(view);
		await closeView(view);
		const calls = h.flashcardManager.getFlashcardInfo.mock.calls.length;
		const reads = h.vault.read.mock.calls.length;

		setLastMutation({ type: "updated", cardId: "a1", changes: {} });
		h.startReview([NOTE_B]);
		await settle(600);

		expect(h.flashcardManager.getFlashcardInfo.mock.calls.length).toBe(calls);
		expect(h.vault.read.mock.calls.length).toBe(reads);
		expect(h.panel.currentFile?.path).toBe(NOTE_A);
	});

	it("reloads once per data change after reopening", async () => {
		const h = twoNotes();
		const first = await openView(h);
		await closeView(first);
		await openView(h);
		const calls = h.flashcardManager.getFlashcardInfo.mock.calls.length;

		setLastMutation({ type: "updated", cardId: "a1", changes: {} });
		await settle();

		expect(h.flashcardManager.getFlashcardInfo.mock.calls.length).toBe(
			calls + 1,
		);
	});

	it("registers one editor listener per open", async () => {
		const h = twoNotes();
		const view = await openView(h);
		expect(view._events).toHaveLength(1);
	});

	// Regression: fixed after the refactor (see REFACTORING.md).
	it("does not rebuild header actions for unrelated store changes", async () => {
		const h = twoNotes();
		const view = await openView(h);
		const addAction = vi.spyOn(view, "addAction");

		h.panel.setSearchQuery("query");
		h.store.getState().review.startSession([]);

		expect(addAction).not.toHaveBeenCalled();
	});

	it("shows header actions only for a note with cards", async () => {
		const h = twoNotes();
		const view = await openView(h);
		expect(view._actions).toEqual(["trash-2", "file-text", "brain"]);

		await view.handleFileChange(h.file("images/pic.png"));
		expect(view._actions).toEqual([]);

		await closeView(view);
		expect(view._actions).toEqual([]);
	});
});
