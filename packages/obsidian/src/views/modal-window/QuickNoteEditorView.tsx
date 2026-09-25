import {
	ItemView,
	Platform,
	Scope,
	type ViewStateResult,
	type WorkspaceLeaf,
} from "obsidian";
import { h, render } from "preact";

import { VIEW_TYPE_QUICK_NOTE_EDITOR } from "@true-recall/core/constants";

import { Clickable } from "@true-recall/obsidian/components";
import { QuickNoteEditorApp } from "@true-recall/obsidian/modals/study/quick-note-editor/QuickNoteEditorApp";
import type {
	QuickNoteEditorMode,
	QuickNoteEditorResult,
} from "@true-recall/obsidian/modals/study/quick-note-editor/types";
import { mountPreact } from "@true-recall/obsidian/preact";

import type TrueRecallPlugin from "../../main";
import { EditorCloseGuard } from "./editor-close-guard";
import { EditorRequestSession } from "./editor-request-session";
import {
	EditorWindowGeometryController,
	type EditorWindowLayout,
} from "./editor-window-geometry";
import { getPopoutWindowFromContainer } from "./popout-helpers";
import {
	consumeQuickNoteEditorRequest,
	type QuickNoteEditorRequestId,
} from "./quick-note-editor-registry";

interface QuickNoteEditorViewState extends Record<string, unknown> {
	requestId?: QuickNoteEditorRequestId;
}

const MIN_WINDOW_HEIGHT = 280;
const FALLBACK_AUTO_DETACH_MS = 50;

/**
 * Obsidian adapter for the Quick Note popout. It turns leaf lifecycle and
 * window events into calls on three collaborators and mounts the editor:
 *
 * - `request` settles the caller's request exactly once,
 * - `closeGuard` decides whether a close may proceed,
 * - `geometry` keeps the popout fitted to its content.
 *
 * The form itself (draft, saving, undo) lives in QuickNoteEditorApp.
 */
export class QuickNoteEditorView extends ItemView {
	private plugin: TrueRecallPlugin;
	private readonly request = new EditorRequestSession<
		QuickNoteEditorRequestId,
		QuickNoteEditorMode,
		QuickNoteEditorResult
	>({
		consume: consumeQuickNoteEditorRequest,
		cancelledResult: () => ({ cancelled: true }),
	});
	private readonly closeGuard = new EditorCloseGuard((signal) =>
		this.confirmDiscardInPopout(signal),
	);
	private readonly geometry = new EditorWindowGeometryController({
		readLayout: () => this.readLayout(),
		minOuterHeight: MIN_WINDOW_HEIGHT,
	});
	private unmountPreact?: () => void;
	private unregisterWindowMigrated: (() => void) | null = null;
	private workspaceTabsEl: HTMLElement | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: TrueRecallPlugin) {
		super(leaf);
		this.plugin = plugin;

		// Escape closes the editor window. A view scope is consulted by the
		// keymap while this leaf is active and wins over Obsidian's app-scope
		// Escape handler, which would otherwise re-activate the last
		// `navigation` leaf in the main window (hiding the review tab)
		// instead of closing this popout. When focus is inside a text input
		// (e.g. the note picker), only consume the event so the component's
		// own Escape handling (closing its dropdown) still applies.
		this.scope = new Scope(this.app.scope);
		this.scope.register([], "Escape", () => {
			const active = this.containerEl.doc.activeElement;
			const isTextInput =
				active?.instanceOf(HTMLInputElement) ||
				active?.instanceOf(HTMLTextAreaElement) ||
				(active?.instanceOf(HTMLElement) && active.isContentEditable);
			if (!isTextInput) this.handleRequestClose();
			return false;
		});
	}

	getViewType(): string {
		return VIEW_TYPE_QUICK_NOTE_EDITOR;
	}

	getDisplayText(): string {
		if (this.request.mode?.mode === "edit") return "Edit flashcard";
		return "Add flashcard";
	}

	getIcon(): string {
		return this.request.mode?.mode === "edit" ? "pencil" : "plus";
	}

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const typedState =
			(state as QuickNoteEditorViewState | null | undefined) ?? null;
		const adopted = this.request.adopt(typedState?.requestId);
		if (adopted) {
			this.closeGuard.reset();
			this.geometry.resetFit();
		}

		await super.setState(state, result);

		if (!this.request.isActive) {
			this.mountFallback();
			return;
		}
		// Re-applying the same state must not rebuild the editor: that would
		// throw away whatever the user has typed.
		if (adopted || !this.unmountPreact) this.mountContent();
	}

	getState(): QuickNoteEditorViewState {
		return { requestId: this.request.requestId };
	}

	onOpen(): Promise<void> {
		// `setState` may have already mounted before `onOpen` fires. Skip
		// double-mount to avoid creating a second CodeMirror tree.
		if (this.request.isActive && !this.unmountPreact) this.mountContent();
		this.markWorkspaceTabs();
		this.installWindowMigrationGuard();
		return Promise.resolve();
	}

	async onClose(): Promise<void> {
		this.geometry.detach();
		this.closeGuard.dispose();
		this.unregisterWindowMigrated?.();
		this.unregisterWindowMigrated = null;
		this.unmarkWorkspaceTabs();
		this.unmountPreact?.();
		this.unmountPreact = undefined;
		this.request.cancel();
	}

	private mountContent(): void {
		const mode = this.request.mode;
		if (!mode) return;
		const container = this.contentEl;

		container.empty();
		container.addClass("tr-quick-editor-view");
		container.toggleClass("is-mac", Platform.isMacOS);

		const title = mode.mode === "edit" ? "Edit flashcard" : "Add flashcard";

		this.unmountPreact?.();
		this.unmountPreact = mountPreact(
			container,
			this.plugin,
			h(
				"div",
				{ class: "tr-quick-editor-view__inner" },
				h(
					"div",
					{ class: "tr-quick-editor-view__drag-bar" },
					h("span", { class: "tr-quick-editor-view__title" }, title),
				),
				h(
					"div",
					{ class: "tr-quick-editor-view__body" },
					h(QuickNoteEditorApp, {
						mode,
						onDone: (result) => this.handleDone(result),
						onRequestClose: () => this.handleRequestClose(),
						onDirtyChange: (dirty) => this.closeGuard.setDirty(dirty),
					}),
				),
			),
		);

		this.bindToWindow({ center: true });
	}

	/** Points the window-level collaborators at the window hosting the view. */
	private bindToWindow(options: { center: boolean }): void {
		const win = getPopoutWindowFromContainer(this.containerEl);
		this.geometry.attach(win, options);
		this.closeGuard.bindWindow(win);
	}

	private readLayout(): EditorWindowLayout | null {
		const dragBar = this.contentEl.querySelector<HTMLElement>(
			".tr-quick-editor-view__drag-bar",
		);
		const body = this.contentEl.querySelector<HTMLElement>(
			".tr-quick-editor-view__body",
		);
		const content = body?.firstElementChild;
		if (!dragBar || !body || !(content instanceof HTMLElement)) return null;
		return {
			viewContent: this.contentEl,
			dragBar,
			body,
			content,
			editor: content.querySelector<HTMLElement>(".true-recall-quick-editor"),
		};
	}

	private installWindowMigrationGuard(): void {
		this.unregisterWindowMigrated?.();
		this.unregisterWindowMigrated = this.containerEl.onWindowMigrated(() => {
			this.markWorkspaceTabs();
			// Observers and listeners built from the previous window's
			// globals are stale; rebind them against the new window.
			if (this.request.isActive) {
				this.bindToWindow({ center: false });
			} else {
				this.geometry.detach();
				this.closeGuard.bindWindow(null);
			}
		});
	}

	private markWorkspaceTabs(): void {
		this.unmarkWorkspaceTabs();
		this.workspaceTabsEl =
			this.containerEl.closest<HTMLElement>(".workspace-tabs");
		this.workspaceTabsEl?.addClass("tr-quick-editor-workspace");
	}

	private unmarkWorkspaceTabs(): void {
		this.workspaceTabsEl?.removeClass("tr-quick-editor-workspace");
		this.workspaceTabsEl = null;
	}

	private mountFallback(): void {
		const container = this.contentEl;
		container.empty();
		container.addClass("tr-quick-editor-view");
		container.createDiv({
			cls: "tr-quick-editor-view__fallback",
			text: "This editor session ended. The window will close automatically.",
		});
		console.warn(
			"[true-recall] QuickNoteEditorView: requestId not in registry; auto-detaching leaf.",
		);
		const win = this.containerEl.win ?? window;
		win.setTimeout(() => this.leaf.detach(), FALLBACK_AUTO_DETACH_MS);
	}

	private handleDone(result: QuickNoteEditorResult): void {
		if (!this.request.isActive) return;
		if (!this.request.settle(result)) {
			console.warn(
				"[true-recall] QuickNoteEditorView.handleDone called after resolve; dropping result",
			);
			return;
		}
		this.leaf.detach();
	}

	private handleRequestClose(): void {
		if (!this.request.isActive) return;
		this.closeGuard.requestClose(() => this.handleDone({ cancelled: true }));
	}

	private confirmDiscardInPopout(signal: AbortSignal): Promise<boolean> {
		const host = this.contentEl.createDiv({
			cls: "tr-quick-editor-view__overlay",
		});
		return new Promise<boolean>((resolve) => {
			let finished = false;
			const finish = (value: boolean) => {
				if (finished) return;
				finished = true;
				signal.removeEventListener("abort", onAbort);
				render(null, host);
				host.remove();
				resolve(value);
			};
			const onAbort = () => finish(false);
			signal.addEventListener("abort", onAbort);
			render(
				h(DiscardOverlay, {
					onConfirm: () => finish(true),
					onCancel: () => finish(false),
				}),
				host,
			);
		});
	}
}

interface DiscardOverlayProps {
	onConfirm: () => void;
	onCancel: () => void;
}

function DiscardOverlay({ onConfirm, onCancel }: DiscardOverlayProps) {
	return h(
		"div",
		{ class: "tr-quick-editor-view__overlay-backdrop" },
		h(
			"div",
			{
				class: "tr-quick-editor-view__overlay-dialog",
				role: "alertdialog",
				"aria-modal": "true",
			},
			h(
				"div",
				{ class: "tr-quick-editor-view__overlay-title" },
				"Discard changes?",
			),
			h(
				"div",
				{ class: "tr-quick-editor-view__overlay-message" },
				"You have unsaved content that will be lost.",
			),
			h(
				"div",
				{ class: "tr-quick-editor-view__overlay-actions" },
				h(
					Clickable,
					{
						class: "ep-btn ep-btn-outline",
						onClick: onCancel,
						stopPropagation: false,
					},
					"Cancel",
				),
				h(
					Clickable,
					{
						class: "mod-warning ep-btn tr-quick-editor-view__discard",
						onClick: onConfirm,
						stopPropagation: false,
					},
					"Discard",
				),
			),
		),
	);
}
