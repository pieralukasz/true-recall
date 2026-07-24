import {
	ItemView,
	Platform,
	type ViewStateResult,
	type WorkspaceLeaf,
} from "obsidian";
import { h } from "preact";

import { VIEW_TYPE_ASSISTANT_EDITOR } from "@true-recall/core/constants";

import { AssistantEditorPanel } from "@true-recall/obsidian/features/assistant/ui/AssistantEditorPanel";
import type { AIWorkspaceMode } from "@true-recall/obsidian/features/assistant/ui/ai-workspace-modes";
import { mountPreact } from "@true-recall/obsidian/preact";

import type TrueRecallPlugin from "../../main";
import {
	type AssistantEditorRequestId,
	consumeAssistantEditorRequest,
	type SourceWindowBounds,
} from "./assistant-editor-registry";
import {
	centerPopoutWindow,
	getPopoutWindowFromContainer,
} from "./popout-helpers";

interface AssistantEditorViewState extends Record<string, unknown> {
	requestId?: AssistantEditorRequestId;
}

interface ActiveSession {
	requestId: AssistantEditorRequestId;
	context: import("@true-recall/core/ai/assistant").AssistantContext;
	sourceBounds: SourceWindowBounds | null;
	initialMode: AIWorkspaceMode;
	onClose?: () => void;
	hasNotified: boolean;
}

const WINDOW_GAP = 12;
const FALLBACK_AUTO_DETACH_MS = 50;

function positionNextToSource(
	win: Window,
	source: SourceWindowBounds | null,
): void {
	if (!source) {
		centerPopoutWindow(win);
		return;
	}

	const screen = win.screen;
	if (!screen) return;
	const extended = screen as Screen & { availLeft?: number; availTop?: number };
	const left = extended.availLeft ?? 0;
	const top = extended.availTop ?? 0;
	const right = left + screen.availWidth;
	const bottom = top + screen.availHeight;
	const rightOfSource = source.x + source.width + WINDOW_GAP;
	const leftOfSource = source.x - win.outerWidth - WINDOW_GAP;

	let x: number;
	if (rightOfSource + win.outerWidth <= right) {
		x = rightOfSource;
	} else if (leftOfSource >= left) {
		x = leftOfSource;
	} else {
		x =
			left + Math.max(0, Math.round((screen.availWidth - win.outerWidth) / 2));
	}
	const y = Math.min(
		Math.max(source.y, top),
		Math.max(top, bottom - win.outerHeight),
	);
	win.moveTo(Math.round(x), Math.round(y));
}

export class AssistantEditorView extends ItemView {
	private session: ActiveSession | null = null;
	private unmountPreact?: () => void;
	private unregisterWindowMigrated: (() => void) | null = null;
	private hasPositioned = false;

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: TrueRecallPlugin,
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_ASSISTANT_EDITOR;
	}

	getDisplayText(): string {
		return "Ask AI";
	}

	getIcon(): string {
		return "wand";
	}

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const typedState =
			(state as AssistantEditorViewState | null | undefined) ?? null;
		const nextRequestId = typedState?.requestId ?? null;

		if (nextRequestId && nextRequestId !== this.session?.requestId) {
			const pending = consumeAssistantEditorRequest(nextRequestId);
			if (pending) {
				this.session = {
					requestId: nextRequestId,
					context: pending.context,
					sourceBounds: pending.sourceBounds,
					initialMode: pending.initialMode,
					onClose: pending.onClose,
					hasNotified: false,
				};
			}
		}

		await super.setState(state, result);
		if (this.session) this.mountContent();
		else this.mountFallback();
	}

	getState(): AssistantEditorViewState {
		return { requestId: this.session?.requestId };
	}

	onOpen(): Promise<void> {
		if (this.session && !this.unmountPreact) this.mountContent();
		this.tryPosition();
		this.installWindowMigrationGuard();
		return Promise.resolve();
	}

	async onClose(): Promise<void> {
		this.unregisterWindowMigrated?.();
		this.unregisterWindowMigrated = null;
		this.unmountPreact?.();
		this.unmountPreact = undefined;
		this.notifyClose();
	}

	private mountContent(): void {
		if (!this.session) return;
		const container = this.contentEl;
		container.empty();
		container.addClass("tr-popout-view");
		container.addClass("tr-assistant-editor-view");
		container.toggleClass("is-mac", Platform.isMacOS);

		this.unmountPreact?.();
		this.unmountPreact = mountPreact(
			container,
			this.plugin,
			h(
				"div",
				{ class: "tr-popout-view__inner" },
				h(
					"div",
					{ class: "tr-popout-view__drag-bar" },
					h("span", { class: "tr-popout-view__title" }, "Ask AI"),
				),
				h(
					"div",
					{ class: "tr-popout-view__body" },
					h(AssistantEditorPanel, {
						context: this.session.context,
						initialMode: this.session.initialMode,
						onClose: () => this.handleRequestClose(),
					}),
				),
			),
		);

		this.tryPosition();
	}

	private tryPosition(): void {
		if (this.hasPositioned) return;
		const win = getPopoutWindowFromContainer(this.containerEl);
		if (!win) return;
		positionNextToSource(win, this.session?.sourceBounds ?? null);
		this.hasPositioned = true;
	}

	private installWindowMigrationGuard(): void {
		this.unregisterWindowMigrated?.();
		this.unregisterWindowMigrated = this.containerEl.onWindowMigrated(() => {
			this.contentEl.toggleClass("is-mac", Platform.isMacOS);
			this.hasPositioned = false;
			this.tryPosition();
		});
	}

	private notifyClose(): void {
		if (!this.session || this.session.hasNotified) return;
		this.session.hasNotified = true;
		this.session.onClose?.();
	}

	private mountFallback(): void {
		const container = this.contentEl;
		container.empty();
		container.addClass("tr-popout-view");
		container.createDiv({
			cls: "tr-popout-view__fallback",
			text: "This AI session ended. The window will close automatically.",
		});
		console.warn(
			"[true-recall] AssistantEditorView: requestId not in registry; auto-detaching leaf.",
		);
		const win = this.containerEl.win ?? window;
		win.setTimeout(() => this.leaf.detach(), FALLBACK_AUTO_DETACH_MS);
	}

	private handleRequestClose(): void {
		try {
			this.leaf.detach();
		} catch (error) {
			console.warn(
				"[true-recall] AssistantEditorView: leaf.detach() failed",
				error,
			);
		}
	}
}
