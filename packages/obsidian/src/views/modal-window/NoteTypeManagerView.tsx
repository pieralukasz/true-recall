import {
	ItemView,
	Platform,
	type ViewStateResult,
	type WorkspaceLeaf,
} from "obsidian";
import { h } from "preact";

import { VIEW_TYPE_NOTE_TYPE_MANAGER } from "@true-recall/core/constants";

import { NoteTypeManagerApp } from "@true-recall/obsidian/modals/core/note-type-manager/NoteTypeManagerApp";
import { mountPreact } from "@true-recall/obsidian/preact";

import type TrueRecallPlugin from "../../main";
import {
	consumeNoteTypeManagerRequest,
	type NoteTypeManagerRequestId,
} from "./note-type-manager-registry";
import {
	centerPopoutWindow,
	getPopoutWindowFromContainer,
} from "./popout-helpers";

interface NoteTypeManagerViewState extends Record<string, unknown> {
	requestId?: NoteTypeManagerRequestId;
}

interface ActiveSession {
	requestId: NoteTypeManagerRequestId;
	onClose?: () => void;
	hasNotified: boolean;
}

// Tiny delay so the "session ended" fallback message gets painted one frame
// before the leaf detaches.
const FALLBACK_AUTO_DETACH_MS = 50;

export class NoteTypeManagerView extends ItemView {
	private plugin: TrueRecallPlugin;
	private session: ActiveSession | null = null;
	private unmountPreact?: () => void;
	private unregisterWindowMigrated: (() => void) | null = null;
	private hasCentered = false;

	constructor(leaf: WorkspaceLeaf, plugin: TrueRecallPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_NOTE_TYPE_MANAGER;
	}

	getDisplayText(): string {
		return "Manage note types";
	}

	getIcon(): string {
		return "list";
	}

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const typedState =
			(state as NoteTypeManagerViewState | null | undefined) ?? null;
		const nextRequestId = typedState?.requestId ?? null;

		if (nextRequestId && nextRequestId !== this.session?.requestId) {
			const pending = consumeNoteTypeManagerRequest(nextRequestId);
			if (pending) {
				this.session = {
					requestId: nextRequestId,
					onClose: pending.onClose,
					hasNotified: false,
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

	getState(): NoteTypeManagerViewState {
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
		container.addClass("tr-note-type-manager-view");
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
					h("span", { class: "tr-popout-view__title" }, "Manage Note Types"),
				),
				h(
					"div",
					{ class: "tr-popout-view__body" },
					h(NoteTypeManagerApp, {
						onClose: () => this.handleRequestClose(),
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
			"[true-recall] NoteTypeManagerView: requestId not in registry; auto-detaching leaf.",
		);
		const win = this.containerEl.win ?? window;
		win.setTimeout(() => this.leaf.detach(), FALLBACK_AUTO_DETACH_MS);
	}

	private handleRequestClose(): void {
		try {
			this.leaf.detach();
		} catch (err) {
			console.warn(
				"[true-recall] NoteTypeManagerView: leaf.detach() failed",
				err,
			);
		}
	}
}
