import {
	ItemView,
	Platform,
	type ViewStateResult,
	type WorkspaceLeaf,
} from "obsidian";
import { h } from "preact";

import { VIEW_TYPE_CARD_TYPES_EDITOR } from "@true-recall/core/constants";

import { CardTypesEditorApp } from "@true-recall/obsidian/modals/core/card-types-editor/CardTypesEditorApp";
import { mountPreact } from "@true-recall/obsidian/preact";

import type TrueRecallPlugin from "../../main";
import {
	type CardTypesEditorRequestId,
	consumeCardTypesEditorRequest,
} from "./card-types-editor-registry";
import {
	centerPopoutWindow,
	getPopoutWindowFromContainer,
} from "./popout-helpers";

interface CardTypesEditorViewState extends Record<string, unknown> {
	requestId?: CardTypesEditorRequestId;
}

interface ActiveSession {
	requestId: CardTypesEditorRequestId;
	noteTypeId: string;
	onClose?: () => void;
	hasNotified: boolean;
	title: string;
}

// Tiny delay so the "session ended" fallback message gets painted one frame
// before the leaf detaches.
const FALLBACK_AUTO_DETACH_MS = 50;

export class CardTypesEditorView extends ItemView {
	private plugin: TrueRecallPlugin;
	private session: ActiveSession | null = null;
	private unmountPreact?: () => void;
	private titleEl: HTMLElement | null = null;
	private unregisterWindowMigrated: (() => void) | null = null;
	private hasCentered = false;

	constructor(leaf: WorkspaceLeaf, plugin: TrueRecallPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_CARD_TYPES_EDITOR;
	}

	getDisplayText(): string {
		return this.session?.title ?? "Card Types";
	}

	getIcon(): string {
		return "layout-template";
	}

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const typedState =
			(state as CardTypesEditorViewState | null | undefined) ?? null;
		const nextRequestId = typedState?.requestId ?? null;

		if (nextRequestId && nextRequestId !== this.session?.requestId) {
			const pending = consumeCardTypesEditorRequest(nextRequestId);
			if (pending) {
				const noteType = this.plugin.noteTypeService.getById(
					pending.noteTypeId,
				);
				const title = `Card Types for "${noteType?.name ?? "Unknown"}"`;
				this.session = {
					requestId: nextRequestId,
					noteTypeId: pending.noteTypeId,
					onClose: pending.onClose,
					hasNotified: false,
					title,
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

	getState(): CardTypesEditorViewState {
		return { requestId: this.session?.requestId };
	}

	onOpen(): Promise<void> {
		// `setState` may have already mounted before `onOpen` fires. Skip
		// double-mount but still retry centering — at setState time the
		// popout window may not yet be bound to containerEl.
		if (this.session && !this.unmountPreact) this.mountContent();
		this.tryCenter();
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

	private notifyClose(): void {
		if (!this.session || this.session.hasNotified) return;
		this.session.hasNotified = true;
		this.session.onClose?.();
	}

	private mountContent(): void {
		if (!this.session) return;
		const container = this.contentEl;

		container.empty();
		container.addClass("tr-popout-view");
		container.addClass("tr-card-types-editor-view");
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
					h(
						"span",
						{
							class: "tr-popout-view__title",
							ref: (el: HTMLElement | null) => {
								this.titleEl = el;
							},
						},
						this.session.title,
					),
				),
				h(
					"div",
					{ class: "tr-popout-view__body" },
					h(CardTypesEditorApp, {
						noteTypeId: this.session.noteTypeId,
						onClose: () => this.handleRequestClose(),
						onTitleChange: (title: string) => this.handleTitleChange(title),
					}),
				),
			),
		);

		this.tryCenter();
	}

	private tryCenter(): void {
		if (this.hasCentered) return;
		const win = getPopoutWindowFromContainer(this.containerEl);
		if (!win) return;
		centerPopoutWindow(win);
		this.hasCentered = true;
	}

	private installWindowMigrationGuard(): void {
		this.unregisterWindowMigrated?.();
		this.unregisterWindowMigrated = this.containerEl.onWindowMigrated(() => {
			// Refresh the `is-mac` chrome padding for the new host window.
			this.contentEl.toggleClass("is-mac", Platform.isMacOS);
			this.hasCentered = false;
			this.tryCenter();
		});
	}

	private mountFallback(): void {
		const container = this.contentEl;
		container.empty();
		container.addClass("tr-popout-view");
		container.createDiv({
			cls: "tr-popout-view__fallback",
			text: "This editor session ended. The window will close automatically.",
		});
		console.warn(
			"[true-recall] CardTypesEditorView: requestId not in registry; auto-detaching leaf.",
		);
		const win = this.containerEl.win ?? window;
		win.setTimeout(() => this.leaf.detach(), FALLBACK_AUTO_DETACH_MS);
	}

	private handleTitleChange(title: string): void {
		if (!this.session) return;
		if (this.session.title === title) return;
		this.session.title = title;
		if (this.titleEl) this.titleEl.textContent = title;
	}

	private handleRequestClose(): void {
		try {
			this.leaf.detach();
		} catch (err) {
			console.warn(
				"[true-recall] CardTypesEditorView: leaf.detach() failed",
				err,
			);
		}
	}
}
