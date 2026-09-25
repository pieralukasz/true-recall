/**
 * Characterization tests for the Quick Note popout window adapter. They pin
 * the request lifecycle, the close paths and the window bookkeeping through
 * the view's public surface (setState/onOpen/onClose plus the callbacks it
 * hands to QuickNoteEditorApp), so the window layer can be restructured
 * without changing what callers and users observe.
 */
import type { VNode } from "preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
	QuickNoteEditorMode,
	QuickNoteEditorResult,
} from "@true-recall/obsidian/modals/study/quick-note-editor/types";
import { QuickNoteEditorView } from "@true-recall/obsidian/views/modal-window/QuickNoteEditorView";
import {
	newQuickNoteEditorRequestId,
	registerQuickNoteEditorRequest,
} from "@true-recall/obsidian/views/modal-window/quick-note-editor-registry";

import {
	createFakeWindow,
	FakeElement,
	FakeResizeObserver,
	type FakeWindow,
} from "./fake-popout";

const mocks = vi.hoisted(() => {
	class Scope {
		handlers = new Map<string, () => boolean | undefined>();
		constructor(readonly parent?: unknown) {}
		register(_mods: string[], key: string, handler: () => boolean) {
			this.handlers.set(key, handler);
		}
	}

	class ItemView {
		app: unknown;
		leaf: unknown;
		containerEl: unknown;
		contentEl: unknown;
		scope: unknown;
		constructor(leaf: {
			app: unknown;
			containerEl: unknown;
			contentEl: unknown;
		}) {
			this.leaf = leaf;
			this.app = leaf.app;
			this.containerEl = leaf.containerEl;
			this.contentEl = leaf.contentEl;
		}
		setState(): Promise<void> {
			return Promise.resolve();
		}
	}

	return {
		Scope,
		ItemView,
		mounts: [] as unknown[],
		unmounts: [] as Array<ReturnType<typeof vi.fn>>,
		overlayRenders: [] as Array<{ vnode: unknown; host: unknown }>,
		onMount: null as null | (() => void),
		outerHeight: { value: 280 },
		centerPopoutWindow: vi.fn(),
		lockPopoutResize: vi.fn(),
		applyPopoutHeight: vi.fn(),
	};
});

vi.mock("obsidian", () => ({
	ItemView: mocks.ItemView,
	Scope: mocks.Scope,
	Platform: { isMacOS: false },
}));

vi.mock("preact", async (importOriginal) => {
	const actual = await importOriginal<typeof import("preact")>();
	return {
		...actual,
		render: (vnode: unknown, host: unknown) => {
			mocks.overlayRenders.push({ vnode, host });
		},
	};
});

vi.mock("@true-recall/obsidian/preact", () => ({
	mountPreact: (_container: unknown, _plugin: unknown, vnode: unknown) => {
		mocks.mounts.push(vnode);
		mocks.onMount?.();
		const unmount = vi.fn();
		mocks.unmounts.push(unmount);
		return unmount;
	},
}));

vi.mock("@true-recall/obsidian/components", () => ({
	Clickable: () => null,
}));

vi.mock(
	"@true-recall/obsidian/modals/study/quick-note-editor/QuickNoteEditorApp",
	() => ({ QuickNoteEditorApp: () => null }),
);

vi.mock("@true-recall/obsidian/views/modal-window/popout-helpers", () => ({
	getPopoutWindowFromContainer: (containerEl: { win?: Window }) =>
		containerEl.win && containerEl.win !== window ? containerEl.win : null,
	centerPopoutWindow: mocks.centerPopoutWindow,
	lockPopoutResize: mocks.lockPopoutResize,
	applyPopoutHeight: mocks.applyPopoutHeight,
	getPopoutOuterHeight: () => mocks.outerHeight.value,
}));

class FakeInput {}
class FakeTextArea {}

interface AppProps {
	mode: QuickNoteEditorMode;
	onDone: (result: QuickNoteEditorResult) => void;
	onRequestClose: () => void;
	onDirtyChange: (dirty: boolean) => void;
}

interface OverlayProps {
	onConfirm: () => void;
	onCancel: () => void;
}

function findAppProps(node: unknown): AppProps | null {
	if (!node || typeof node !== "object") return null;
	const vnode = node as VNode<Record<string, unknown>>;
	const props = vnode.props ?? {};
	if (typeof props.onDirtyChange === "function")
		return props as unknown as AppProps;
	const children = props.children;
	const list = Array.isArray(children) ? children : [children];
	for (const child of list) {
		const found = findAppProps(child);
		if (found) return found;
	}
	return null;
}

interface Harness {
	view: InstanceType<typeof QuickNoteEditorView>;
	fw: FakeWindow;
	containerEl: FakeElement;
	contentEl: FakeElement;
	workspaceTabs: FakeElement;
	leaf: { detach: ReturnType<typeof vi.fn> };
	resolve: ReturnType<typeof vi.fn>;
	requestId: ReturnType<typeof newQuickNoteEditorRequestId>;
	layout: { content: FakeElement; editor: FakeElement };
	open(): Promise<void>;
	app(): AppProps;
	escape(): boolean | undefined;
	overlays(): OverlayProps[];
}

function createHarness(
	options: { popout?: boolean; mode?: QuickNoteEditorMode } = {},
): Harness {
	const popout = options.popout ?? true;
	const fw = createFakeWindow();
	const containerEl = new FakeElement();
	containerEl.win = popout ? fw.win : window;
	const contentEl = new FakeElement();
	contentEl.offsetHeight = 360;
	const workspaceTabs = new FakeElement();
	containerEl.closestMap.set(".workspace-tabs", workspaceTabs);

	const dragBar = new FakeElement();
	dragBar.offsetHeight = 40;
	const body = new FakeElement();
	const content = new FakeElement();
	content.offsetHeight = 300;
	content.scrollHeight = 300;
	const editor = new FakeElement();
	body.children.push(content);
	body.selectorMap.set(".true-recall-quick-editor", editor);
	content.selectorMap.set(".true-recall-quick-editor", editor);
	contentEl.selectorMap.set(".tr-quick-editor-view__drag-bar", dragBar);
	contentEl.selectorMap.set(".tr-quick-editor-view__body", body);

	const leaf = {
		detach: vi.fn(),
		app: { scope: {} },
		containerEl,
		contentEl,
	};
	const plugin = {};
	const view = new QuickNoteEditorView(leaf as never, plugin as never);
	const resolve = vi.fn();
	const requestId = newQuickNoteEditorRequestId();
	registerQuickNoteEditorRequest(
		requestId,
		options.mode ?? { mode: "add" },
		resolve,
	);

	return {
		view,
		fw,
		containerEl,
		contentEl,
		workspaceTabs,
		leaf,
		resolve,
		requestId,
		layout: { content, editor },
		async open() {
			await view.setState({ requestId }, {} as never);
			await view.onOpen();
		},
		app() {
			const props = findAppProps(mocks.mounts.at(-1));
			if (!props) throw new Error("QuickNoteEditorApp was not mounted");
			return props;
		},
		escape() {
			const scope = (
				view as unknown as { scope: InstanceType<typeof mocks.Scope> }
			).scope;
			return scope.handlers.get("Escape")?.();
		},
		overlays() {
			return mocks.overlayRenders
				.map((entry) => entry.vnode as VNode<OverlayProps> | null)
				.filter((vnode): vnode is VNode<OverlayProps> => vnode !== null)
				.map((vnode) => vnode.props);
		},
	};
}

function beforeUnloadEvent() {
	return { preventDefault: vi.fn() };
}

beforeEach(() => {
	mocks.mounts.length = 0;
	mocks.unmounts.length = 0;
	mocks.overlayRenders.length = 0;
	mocks.onMount = null;
	mocks.outerHeight.value = 280;
	mocks.centerPopoutWindow.mockReset();
	mocks.lockPopoutResize.mockReset();
	mocks.applyPopoutHeight.mockReset();
	FakeResizeObserver.instances.length = 0;
	vi.stubGlobal("HTMLElement", FakeElement);
	vi.stubGlobal("HTMLInputElement", FakeInput);
	vi.stubGlobal("HTMLTextAreaElement", FakeTextArea);
	vi.stubGlobal("ResizeObserver", FakeResizeObserver);
	vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("QuickNoteEditorView", () => {
	describe("request lifecycle", () => {
		it("mounts the editor for a registered request and reports its id", async () => {
			const h = createHarness({ mode: { mode: "add" } });
			await h.open();

			expect(mocks.mounts).toHaveLength(1);
			expect(h.app().mode).toEqual({ mode: "add" });
			expect(h.view.getState()).toEqual({ requestId: h.requestId });
			expect(h.view.getDisplayText()).toBe("Add flashcard");
			expect(h.view.getIcon()).toBe("plus");
		});

		it("titles an edit session accordingly", async () => {
			const h = createHarness({
				mode: { mode: "edit" } as unknown as QuickNoteEditorMode,
			});
			await h.open();

			expect(h.view.getDisplayText()).toBe("Edit flashcard");
			expect(h.view.getIcon()).toBe("pencil");
		});

		it("does not mount twice when onOpen follows setState", async () => {
			const h = createHarness();
			await h.open();

			expect(mocks.mounts).toHaveLength(1);
		});

		it("shows the fallback and detaches when the request is unknown", async () => {
			const h = createHarness();
			await h.view.setState(
				{ requestId: newQuickNoteEditorRequestId() },
				{} as never,
			);

			expect(mocks.mounts).toHaveLength(0);
			expect(
				h.contentEl.children.some((child) =>
					child.classes.has("tr-quick-editor-view__fallback"),
				),
			).toBe(true);
			expect(h.fw.setTimeout).toHaveBeenCalledTimes(1);
			expect(h.leaf.detach).toHaveBeenCalledTimes(1);
		});

		it("resolves Done with the editor's result and closes the leaf", async () => {
			const h = createHarness();
			await h.open();

			h.app().onDone({ cancelled: false, updatedCardIds: ["c1"] });

			expect(h.resolve).toHaveBeenCalledTimes(1);
			expect(h.resolve).toHaveBeenCalledWith({
				cancelled: false,
				updatedCardIds: ["c1"],
			});
			expect(h.leaf.detach).toHaveBeenCalledTimes(1);
		});

		it("drops a second Done after the request settled", async () => {
			const h = createHarness();
			await h.open();

			h.app().onDone({ cancelled: false });
			h.app().onDone({ cancelled: true });
			await h.view.onClose();

			expect(h.resolve).toHaveBeenCalledTimes(1);
			expect(h.resolve).toHaveBeenCalledWith({ cancelled: false });
			expect(h.leaf.detach).toHaveBeenCalledTimes(1);
		});

		it("resolves as cancelled when the leaf closes without Done", async () => {
			const h = createHarness();
			await h.open();

			await h.view.onClose();

			expect(h.resolve).toHaveBeenCalledTimes(1);
			expect(h.resolve).toHaveBeenCalledWith({ cancelled: true });
		});

		it("starts a replacing request clean and re-centred", async () => {
			const h = createHarness();
			await h.open();
			h.fw.flushFrames();
			h.app().onDirtyChange(true);
			const nextId = newQuickNoteEditorRequestId();
			registerQuickNoteEditorRequest(nextId, { mode: "add" }, vi.fn());

			await h.view.setState({ requestId: nextId }, {} as never);
			h.fw.flushFrames();
			h.app().onRequestClose();

			expect(h.overlays()).toHaveLength(0);
			expect(mocks.applyPopoutHeight).toHaveBeenLastCalledWith(h.fw.win, 396, {
				center: true,
			});
		});

		it("unmounts the editor on close", async () => {
			const h = createHarness();
			await h.open();

			await h.view.onClose();

			expect(mocks.unmounts[0]).toHaveBeenCalledTimes(1);
		});
	});

	describe("close requests", () => {
		it("closes a clean editor without asking", async () => {
			const h = createHarness();
			await h.open();

			h.app().onRequestClose();
			await Promise.resolve();

			expect(h.overlays()).toHaveLength(0);
			expect(h.resolve).toHaveBeenCalledWith({ cancelled: true });
			expect(h.leaf.detach).toHaveBeenCalledTimes(1);
		});

		it("closes a clean editor synchronously", async () => {
			const h = createHarness();
			await h.open();

			h.app().onRequestClose();

			expect(h.leaf.detach).toHaveBeenCalledTimes(1);
		});

		it("keeps a dirty editor open when the discard is cancelled", async () => {
			const h = createHarness();
			await h.open();
			h.app().onDirtyChange(true);

			h.app().onRequestClose();
			expect(h.overlays()).toHaveLength(1);
			h.overlays()[0]?.onCancel();
			await Promise.resolve();
			await Promise.resolve();

			expect(h.resolve).not.toHaveBeenCalled();
			expect(h.leaf.detach).not.toHaveBeenCalled();
			expect(mocks.mounts).toHaveLength(1);
			expect(mocks.unmounts[0]).not.toHaveBeenCalled();
		});

		it("closes a dirty editor once the discard is confirmed", async () => {
			const h = createHarness();
			await h.open();
			h.app().onDirtyChange(true);

			h.app().onRequestClose();
			h.overlays()[0]?.onConfirm();
			await Promise.resolve();
			await Promise.resolve();

			expect(h.resolve).toHaveBeenCalledTimes(1);
			expect(h.resolve).toHaveBeenCalledWith({ cancelled: true });
			expect(h.leaf.detach).toHaveBeenCalledTimes(1);
		});

		it("asks again after a cancelled discard", async () => {
			const h = createHarness();
			await h.open();
			h.app().onDirtyChange(true);

			h.app().onRequestClose();
			h.overlays()[0]?.onCancel();
			await Promise.resolve();
			await Promise.resolve();
			h.app().onRequestClose();

			expect(h.overlays()).toHaveLength(2);
		});

		it("shows a single dialog for repeated close requests", async () => {
			const h = createHarness();
			await h.open();
			h.app().onDirtyChange(true);

			h.app().onRequestClose();
			h.app().onRequestClose();
			h.escape();

			expect(h.overlays()).toHaveLength(1);
		});

		it("removes the dialog host after an answer", async () => {
			const h = createHarness();
			await h.open();
			h.app().onDirtyChange(true);

			h.app().onRequestClose();
			const hosts = h.contentEl.children.filter((child) =>
				child.classes.has("tr-quick-editor-view__overlay"),
			);
			expect(hosts).toHaveLength(1);
			h.overlays()[0]?.onCancel();

			expect(
				h.contentEl.children.filter((child) =>
					child.classes.has("tr-quick-editor-view__overlay"),
				),
			).toHaveLength(0);
		});
	});

	describe("Escape", () => {
		it("requests a close outside text inputs", async () => {
			const h = createHarness();
			await h.open();

			const handled = h.escape();
			await Promise.resolve();

			expect(handled).toBe(false);
			expect(h.leaf.detach).toHaveBeenCalledTimes(1);
		});

		it.each([
			["an input", FakeInput, false],
			["a textarea", FakeTextArea, false],
			["a contenteditable element", null, true],
		])("leaves Escape to %s", async (_label, kind, editable) => {
			const h = createHarness();
			await h.open();
			const active = new FakeElement();
			if (kind) active.kinds.add(kind);
			else active.kinds.add(FakeElement);
			active.isContentEditable = editable;
			h.containerEl.doc.activeElement = active;

			const handled = h.escape();
			await Promise.resolve();

			expect(handled).toBe(false);
			expect(h.leaf.detach).not.toHaveBeenCalled();
		});
	});

	describe("unload guard", () => {
		it("blocks closing the popout with unsaved content", async () => {
			const h = createHarness();
			await h.open();
			h.app().onDirtyChange(true);

			const event = beforeUnloadEvent();
			h.fw.dispatch("beforeunload", event);

			expect(event.preventDefault).toHaveBeenCalledTimes(1);
		});

		it("lets a clean popout close", async () => {
			const h = createHarness();
			await h.open();

			const event = beforeUnloadEvent();
			h.fw.dispatch("beforeunload", event);

			expect(event.preventDefault).not.toHaveBeenCalled();
		});

		it("lets the popout close after the discard was confirmed", async () => {
			const h = createHarness();
			await h.open();
			h.app().onDirtyChange(true);
			h.app().onRequestClose();
			h.overlays()[0]?.onConfirm();
			await Promise.resolve();
			await Promise.resolve();

			const event = beforeUnloadEvent();
			h.fw.dispatch("beforeunload", event);

			expect(event.preventDefault).not.toHaveBeenCalled();
		});
	});

	describe("window geometry", () => {
		it("centres, locks and fits the popout on mount", async () => {
			const h = createHarness();
			await h.open();

			expect(mocks.centerPopoutWindow).toHaveBeenCalledWith(h.fw.win);
			expect(mocks.lockPopoutResize).toHaveBeenCalledWith(h.fw.win);
			expect(h.fw.frames.size).toBe(1);

			h.fw.flushFrames();

			// drag bar 40 + content 300 + padding 16 + tab header (400 - 360)
			expect(mocks.applyPopoutHeight).toHaveBeenCalledWith(h.fw.win, 396, {
				center: true,
			});
		});

		it("re-fits without re-centring after the first fit", async () => {
			const h = createHarness();
			await h.open();
			h.fw.flushFrames();
			mocks.outerHeight.value = 396;

			h.layout.content.offsetHeight = 420;
			h.layout.content.scrollHeight = 420;
			h.fw.dispatch("resize");
			h.fw.flushFrames();

			expect(mocks.applyPopoutHeight).toHaveBeenLastCalledWith(h.fw.win, 516, {
				center: false,
			});
		});

		it("skips resizes within 4px once fitted", async () => {
			const h = createHarness();
			await h.open();
			h.fw.flushFrames();
			mocks.outerHeight.value = 398;
			mocks.applyPopoutHeight.mockClear();

			h.fw.dispatch("resize");
			h.fw.flushFrames();

			expect(mocks.applyPopoutHeight).not.toHaveBeenCalled();
		});

		it("coalesces resize triggers into one frame", async () => {
			const h = createHarness();
			await h.open();

			h.fw.dispatch("resize");
			h.fw.dispatch("resize");
			FakeResizeObserver.instances[0]?.callback();

			expect(h.fw.frames.size).toBe(1);
		});

		it("observes the editor content", async () => {
			const h = createHarness();
			await h.open();

			const observer = FakeResizeObserver.instances[0];
			expect(observer?.observed.has(h.layout.content)).toBe(true);
			expect(observer?.observed.has(h.layout.editor)).toBe(true);
		});

		it("leaves the main window alone for an embedded view", async () => {
			const h = createHarness({ popout: false });
			await h.open();

			expect(mocks.centerPopoutWindow).not.toHaveBeenCalled();
			expect(mocks.lockPopoutResize).not.toHaveBeenCalled();
			expect(FakeResizeObserver.instances).toHaveLength(0);
			expect(h.fw.listenerCount("resize")).toBe(0);
			expect(h.fw.listenerCount("beforeunload")).toBe(0);
		});
	});

	describe("cleanup", () => {
		it("releases listeners, frames and observers on close", async () => {
			const h = createHarness();
			await h.open();
			expect(h.fw.listenerCount("resize")).toBe(1);
			expect(h.fw.listenerCount("beforeunload")).toBe(1);

			await h.view.onClose();

			expect(h.fw.listenerCount("resize")).toBe(0);
			expect(h.fw.listenerCount("beforeunload")).toBe(0);
			expect(h.fw.cancelAnimationFrame).toHaveBeenCalledTimes(1);
			expect(h.fw.frames.size).toBe(0);
			expect(FakeResizeObserver.instances[0]?.disconnected).toBe(true);
			expect(h.containerEl.migrationListenerCount).toBe(0);
		});

		it("marks the workspace tabs while open", async () => {
			const h = createHarness();
			await h.open();
			expect(h.workspaceTabs.classes.has("tr-quick-editor-workspace")).toBe(
				true,
			);

			await h.view.onClose();

			expect(h.workspaceTabs.classes.has("tr-quick-editor-workspace")).toBe(
				false,
			);
		});

		it("moves every window listener when the view migrates", async () => {
			const h = createHarness();
			await h.open();
			h.fw.flushFrames();
			const next = createFakeWindow();

			h.containerEl.migrateTo(next.win);

			expect(h.fw.listenerCount("resize")).toBe(0);
			expect(h.fw.listenerCount("beforeunload")).toBe(0);
			expect(next.listenerCount("resize")).toBe(1);
			expect(next.listenerCount("beforeunload")).toBe(1);
			expect(mocks.lockPopoutResize).toHaveBeenLastCalledWith(next.win);
			expect(FakeResizeObserver.instances[0]?.disconnected).toBe(true);
			expect(FakeResizeObserver.instances).toHaveLength(2);
		});

		it("drops unload and resize listeners when a migration follows a finished session", async () => {
			const h = createHarness();
			await h.view.setState(
				{ requestId: newQuickNoteEditorRequestId() },
				{} as never,
			);
			await h.view.onOpen();
			const next = createFakeWindow();

			h.containerEl.migrateTo(next.win);

			expect(next.listenerCount("resize")).toBe(0);
			expect(next.listenerCount("beforeunload")).toBe(0);
		});

		it("keeps the unload guard working after a migration", async () => {
			const h = createHarness();
			await h.open();
			h.app().onDirtyChange(true);
			const next = createFakeWindow();

			h.containerEl.migrateTo(next.win);
			const event = beforeUnloadEvent();
			next.dispatch("beforeunload", event);

			expect(event.preventDefault).toHaveBeenCalledTimes(1);
		});
	});

	// Deliberate behaviour changes made with the window-layer refactor. Each
	// case failed against the previous implementation; see REFACTORING.md.
	describe("fixed edge cases", () => {
		it("keeps the mounted editor when the same state is applied again", async () => {
			const h = createHarness();
			await h.open();

			await h.view.setState({ requestId: h.requestId }, {} as never);

			expect(mocks.mounts).toHaveLength(1);
			expect(mocks.unmounts[0]).not.toHaveBeenCalled();
		});

		it("settles the previous request when a new one replaces it", async () => {
			const h = createHarness();
			await h.open();
			const nextResolve = vi.fn();
			const nextId = newQuickNoteEditorRequestId();
			registerQuickNoteEditorRequest(nextId, { mode: "add" }, nextResolve);

			await h.view.setState({ requestId: nextId }, {} as never);

			expect(h.resolve).toHaveBeenCalledWith({ cancelled: true });
			expect(nextResolve).not.toHaveBeenCalled();
			expect(h.view.getState()).toEqual({ requestId: nextId });
			expect(mocks.mounts).toHaveLength(2);
		});

		it("dismisses an open discard dialog when the window closes", async () => {
			const h = createHarness();
			await h.open();
			h.app().onDirtyChange(true);
			h.app().onRequestClose();

			await h.view.onClose();
			await Promise.resolve();
			await Promise.resolve();

			expect(
				h.contentEl.children.filter((child) =>
					child.classes.has("tr-quick-editor-view__overlay"),
				),
			).toHaveLength(0);
			expect(h.resolve).toHaveBeenCalledTimes(1);
			expect(h.resolve).toHaveBeenCalledWith({ cancelled: true });
			expect(h.leaf.detach).not.toHaveBeenCalled();
		});
	});
});
