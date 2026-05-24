import {
	ItemView,
	Platform,
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
import {
	consumeQuickNoteEditorRequest,
	type QuickNoteEditorRequestId,
} from "./quick-note-editor-registry";

interface QuickNoteEditorViewState extends Record<string, unknown> {
	requestId?: QuickNoteEditorRequestId;
}

interface ActiveSession {
	requestId: QuickNoteEditorRequestId;
	mode: QuickNoteEditorMode;
	resolve: (r: QuickNoteEditorResult) => void;
	hasResolved: boolean;
	isDirty: boolean;
	closeConfirmed: boolean;
	hasInitialFitted: boolean;
}

const MIN_WINDOW_HEIGHT = 280;
const FALLBACK_AUTO_DETACH_MS = 50;

export class QuickNoteEditorView extends ItemView {
	private plugin: TrueRecallPlugin;
	private session: ActiveSession | null = null;
	private unmountPreact?: () => void;
	private resizeObserver: ResizeObserver | null = null;
	private resizeRafId: number | null = null;
	private unregisterWindowMigrated: (() => void) | null = null;
	private beforeUnloadHandler: ((e: BeforeUnloadEvent) => void) | null = null;
	private boundWindow: Window | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: TrueRecallPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_QUICK_NOTE_EDITOR;
	}

	getDisplayText(): string {
		if (this.session?.mode.mode === "edit") return "Edit Flashcard";
		return "Add Flashcard";
	}

	getIcon(): string {
		return this.session?.mode.mode === "edit" ? "pencil" : "plus";
	}

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const typedState =
			(state as QuickNoteEditorViewState | null | undefined) ?? null;
		const nextRequestId = typedState?.requestId ?? null;

		if (nextRequestId && nextRequestId !== this.session?.requestId) {
			const pending = consumeQuickNoteEditorRequest(nextRequestId);
			if (pending) {
				this.session = {
					requestId: nextRequestId,
					mode: pending.mode,
					resolve: pending.resolve,
					hasResolved: false,
					isDirty: false,
					closeConfirmed: false,
					hasInitialFitted: false,
				};
			}
		}

		await super.setState(state, result);

		if (this.session) {
			this.mountContent();
		} else {
			this.mountFallback();
		}
	}

	getState(): QuickNoteEditorViewState {
		return { requestId: this.session?.requestId };
	}

	onOpen(): Promise<void> {
		// `setState` may have already mounted before `onOpen` fires. Skip
		// double-mount to avoid creating a second CodeMirror tree.
		if (this.session && !this.unmountPreact) this.mountContent();
		this.installWindowMigrationGuard();
		return Promise.resolve();
	}

	async onClose(): Promise<void> {
		this.stopContentSizeTracking();
		this.uninstallBeforeUnloadGuard();
		this.unregisterWindowMigrated?.();
		this.unregisterWindowMigrated = null;
		this.unmountPreact?.();
		this.unmountPreact = undefined;
		this.resolveCancelledIfPending();
	}

	private resolveCancelledIfPending(): void {
		if (!this.session) return;
		if (this.session.hasResolved) return;
		this.session.hasResolved = true;
		this.session.resolve({ cancelled: true });
	}

	private mountContent(): void {
		if (!this.session) return;
		const container = this.contentEl;

		container.empty();
		container.addClass("tr-quick-editor-view");
		container.toggleClass("is-mac", Platform.isMacOS);

		const winAtMount = this.getPopoutWindow();
		if (winAtMount) {
			console.log("[QNE diag] mountContent — initial popout dims", {
				outerW: winAtMount.outerWidth,
				outerH: winAtMount.outerHeight,
				innerW: winAtMount.innerWidth,
				innerH: winAtMount.innerHeight,
				chrome: winAtMount.outerHeight - winAtMount.innerHeight,
				screenAvailH: winAtMount.screen?.availHeight,
				devicePixelRatio: winAtMount.devicePixelRatio,
				ts: performance.now(),
			});
		}

		const title =
			this.session.mode.mode === "edit" ? "Edit Flashcard" : "Add Flashcard";

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
						mode: this.session.mode,
						onDone: (result) => this.handleDone(result),
						onRequestClose: () => void this.handleRequestClose(),
						onDirtyChange: (dirty) => {
							if (this.session) this.session.isDirty = dirty;
						},
					}),
				),
			),
		);

		this.startContentSizeTracking();
		this.installBeforeUnloadGuard();
	}

	private startContentSizeTracking(): void {
		this.stopContentSizeTracking();
		const win = this.getPopoutWindow();
		if (!win) return;
		const body = this.contentEl.querySelector<HTMLElement>(
			".tr-quick-editor-view__body",
		);
		if (!body) return;

		this.scheduleResizeToContent();

		const RO =
			(win as Window & { ResizeObserver?: typeof ResizeObserver })
				.ResizeObserver ?? ResizeObserver;
		const observer = new RO(() => {
			this.scheduleResizeToContent();
		});
		this.resizeObserver = observer;
		const target = body.firstElementChild;
		if (target instanceof HTMLElement) {
			observer.observe(target);
		} else {
			observer.observe(body);
		}
	}

	private stopContentSizeTracking(): void {
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		if (this.resizeRafId !== null) {
			const win = this.boundWindow ?? this.getPopoutWindow();
			win?.cancelAnimationFrame(this.resizeRafId);
			this.resizeRafId = null;
		}
	}

	private scheduleResizeToContent(): void {
		const win = this.getPopoutWindow();
		if (!win) return;
		if (this.resizeRafId !== null) return;
		this.resizeRafId = win.requestAnimationFrame(() => {
			this.resizeRafId = null;
			this.resizeWindowToContent();
		});
	}

	private getPopoutWindow(): Window | null {
		const win = this.containerEl.win;
		// Modal/in-app contexts share the main window — skip resize there to
		// avoid resizing the entire Obsidian app window.
		if (!win || win === window) return null;
		return win;
	}

	private resizeWindowToContent(): void {
		const win = this.getPopoutWindow();
		if (!win || !this.session) return;
		const dragBar = this.contentEl.querySelector<HTMLElement>(
			".tr-quick-editor-view__drag-bar",
		);
		const body = this.contentEl.querySelector<HTMLElement>(
			".tr-quick-editor-view__body",
		);
		const content = body?.firstElementChild;
		if (!dragBar || !body || !(content instanceof HTMLElement)) return;

		const bodyStyle = win.getComputedStyle(body);
		const paddingTop = parseFloat(bodyStyle.paddingTop) || 0;
		const paddingBottom = parseFloat(bodyStyle.paddingBottom) || 0;
		const bodyPadding = paddingTop + paddingBottom;
		const natural = dragBar.offsetHeight + content.offsetHeight + bodyPadding;
		if (!Number.isFinite(natural)) return;

		const chrome = Math.max(0, win.outerHeight - win.innerHeight);
		const target = Math.round(natural + chrome);

		const screen = win.screen;
		const max = screen?.availHeight ?? 1200;
		const clamped = Math.max(MIN_WINDOW_HEIGHT, Math.min(max, target));
		if (!Number.isFinite(clamped)) return;

		console.log("[QNE diag] resizeWindowToContent", {
			outerH: win.outerHeight,
			innerH: win.innerHeight,
			chrome,
			dragBarH: dragBar.offsetHeight,
			contentH: content.offsetHeight,
			bodyPadding,
			natural,
			target,
			clamped,
			fitted: this.session.hasInitialFitted,
			ts: performance.now(),
		});

		if (
			Math.abs(clamped - win.outerHeight) < 4 &&
			this.session.hasInitialFitted
		) {
			return;
		}

		const newW = win.outerWidth;
		const newH = clamped;
		win.resizeTo(newW, newH);

		// Recenter only on first fit, so subsequent content growth doesn't
		// teleport the window around while the user is typing.
		if (!this.session.hasInitialFitted) {
			// availLeft/availTop are non-standard (multi-monitor offsets) and
			// missing from lib.dom typings, but supported in Chromium/Electron.
			const extScreen = screen as
				| (Screen & { availLeft?: number; availTop?: number })
				| undefined;
			const availLeft = extScreen?.availLeft ?? 0;
			const availTop = extScreen?.availTop ?? 0;
			const availWidth = screen?.availWidth ?? newW;
			const availHeight = screen?.availHeight ?? newH;
			const left = availLeft + Math.round((availWidth - newW) / 2);
			const top = availTop + Math.round((availHeight - newH) / 2);
			win.moveTo(left, top);
			this.session.hasInitialFitted = true;
		}
	}

	private installWindowMigrationGuard(): void {
		this.unregisterWindowMigrated?.();
		this.unregisterWindowMigrated = this.containerEl.onWindowMigrated(() => {
			// Rebind ResizeObserver + beforeunload against the new window;
			// observers captured against the prior window's globals are stale.
			this.uninstallBeforeUnloadGuard();
			if (this.session) {
				this.startContentSizeTracking();
				this.installBeforeUnloadGuard();
			}
		});
	}

	private installBeforeUnloadGuard(): void {
		this.uninstallBeforeUnloadGuard();
		const win = this.getPopoutWindow();
		if (!win) return;
		const handler = (e: BeforeUnloadEvent) => {
			if (!this.session || !this.session.isDirty) return;
			if (this.session.closeConfirmed) return;
			// Triggers Electron's native confirm dialog when the user closes
			// the popout window via the OS X-button with unsaved content.
			e.preventDefault();
			e.returnValue = "";
		};
		win.addEventListener("beforeunload", handler);
		this.beforeUnloadHandler = handler;
		this.boundWindow = win;
	}

	private uninstallBeforeUnloadGuard(): void {
		if (this.beforeUnloadHandler && this.boundWindow) {
			this.boundWindow.removeEventListener(
				"beforeunload",
				this.beforeUnloadHandler,
			);
		}
		this.beforeUnloadHandler = null;
		this.boundWindow = null;
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
		if (!this.session) return;
		if (this.session.hasResolved) {
			console.warn(
				"[true-recall] QuickNoteEditorView.handleDone called after resolve; dropping result",
			);
			return;
		}
		this.session.hasResolved = true;
		this.session.resolve(result);
		this.leaf.detach();
	}

	private async handleRequestClose(): Promise<void> {
		if (!this.session) return;
		if (this.session.isDirty && !this.session.closeConfirmed) {
			const confirmed = await this.confirmDiscardInPopout();
			if (!confirmed) return;
			this.session.closeConfirmed = true;
		}
		this.handleDone({ cancelled: true });
	}

	private confirmDiscardInPopout(): Promise<boolean> {
		const host = this.contentEl.createDiv({
			cls: "tr-quick-editor-view__overlay",
		});
		return new Promise<boolean>((resolve) => {
			const finish = (value: boolean) => {
				render(null, host);
				host.remove();
				resolve(value);
			};
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
						class: "mod-warning ep-btn",
						onClick: onConfirm,
						stopPropagation: false,
					},
					"Discard",
				),
			),
		),
	);
}
