import {
	ItemView,
	type Menu,
	Platform,
	type TFile,
	type ViewStateResult,
	type WorkspaceLeaf,
} from "obsidian";
import { h } from "preact";
import { shallow } from "zustand/shallow";

import { VIEW_TYPE_FLASHCARD_PANEL } from "@true-recall/core/constants";
import { CollectService } from "@true-recall/core/flashcard/lifecycle/collect.service";

import { downloadBlob } from "@true-recall/obsidian/features/integration/utils/export-helpers";
import { cardsToBlockText } from "@true-recall/obsidian/features/library/ui/panel/utils/panel-helpers";
import { mountPreact } from "@true-recall/obsidian/preact/mount";
import type { PanelApi } from "@true-recall/obsidian/store";
import {
	FlashcardPanelApp,
	type PanelAppActions,
} from "@true-recall/obsidian/views/panel/FlashcardPanelApp";

import type TrueRecallPlugin from "../../main";
import { PanelActions } from "./PanelActions";
import { PanelDataLoader } from "./PanelDataLoader";
import { PanelSourceController } from "./PanelSourceController";

/**
 * Obsidian shell for the flashcard sidebar: lifecycle, header actions, pane
 * menu, and Preact mounting. Source selection, loading, and note actions live
 * in PanelSourceController, PanelDataLoader, and PanelActions.
 */
export class FlashcardPanelView extends ItemView {
	private plugin: TrueRecallPlugin;
	private loader: PanelDataLoader;
	private source: PanelSourceController;
	private actions: PanelActions;

	private unmountPreact: (() => void) | null = null;
	private headerActionsUnsub: (() => void) | null = null;
	private headerActionEls: HTMLElement[] = [];

	constructor(leaf: WorkspaceLeaf, plugin: TrueRecallPlugin) {
		super(leaf);
		this.plugin = plugin;
		const getPanel = () => this.panel;
		const collectService = new CollectService((slug) =>
			plugin.noteTypeService.getBySlug(slug),
		);

		this.loader = new PanelDataLoader({
			vault: {
				getAbstractFileByPath: (path) =>
					this.app.vault.getAbstractFileByPath(path),
				read: (file) => this.app.vault.read(file),
			},
			flashcardManager: plugin.flashcardManager,
			countUncollected: (content) =>
				collectService.countFlashcardLines(content),
			getPanel,
		});
		this.source = new PanelSourceController({
			vault: {
				getAbstractFileByPath: (path) =>
					this.app.vault.getAbstractFileByPath(path),
			},
			workspace: {
				getActiveFile: () => this.app.workspace.getActiveFile(),
				getLastOpenFiles: () => this.app.workspace.getLastOpenFiles(),
			},
			getStore: () => plugin.store,
			getPanel,
			load: () => this.loader.load(),
			isMobile: () => Platform.isMobile,
		});
		this.actions = new PanelActions({
			openNote: (path) => this.app.workspace.openLinkText(path, ""),
			getPanel,
			getCommandService: () => plugin.commandService,
			cardsToText: (cards) => cardsToBlockText(cards, plugin),
			confirm: async (message) => {
				const { confirm } = await import(
					"@true-recall/obsidian/modals/shared/ConfirmModal"
				);
				return confirm(this.app, { message });
			},
			writeClipboard: (text) => navigator.clipboard.writeText(text),
			downloadFile: downloadBlob,
		});
	}

	private get panel(): PanelApi {
		const store = this.plugin.store;
		if (!store) throw new Error("Store not initialized");
		return store.getState().panel;
	}

	getViewType(): string {
		return VIEW_TYPE_FLASHCARD_PANEL;
	}

	getDisplayText(): string {
		return "True Recall";
	}

	getIcon(): string {
		return "layers";
	}

	getState(): Record<string, unknown> {
		const state = super.getState();
		const currentPath = this.plugin.store?.getState().panel.currentFile?.path;
		return { ...state, file: currentPath ?? null };
	}

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		await super.setState(state, result);
		const filePath = (state as { file?: unknown } | null)?.file;
		if (typeof filePath !== "string" || !filePath) return;
		this.source.restore(filePath);
	}

	onPaneMenu(menu: Menu, source: string): void {
		super.onPaneMenu(menu, source);

		if (!Platform.isMobile) return;

		const state = this.panel;
		if (!state.currentFile) return;

		menu.addItem((item) => {
			item
				.setTitle("Refresh")
				.setIcon("refresh-cw")
				.onClick(() => void this.loader.load());
		});

		if (state.status !== "exists") return;

		menu.addSeparator();
		menu.addItem((item) => {
			item
				.setTitle("Copy to clipboard")
				.setIcon("clipboard-copy")
				.onClick(() => void this.actions.copyAllToClipboard());
		});
		menu.addItem((item) => {
			item
				.setTitle("Export as CSV")
				.setIcon("file-down")
				.onClick(() => this.actions.exportCsv());
		});

		menu.addSeparator();
		menu.addItem((item) => {
			item
				.setTitle("Open flashcard file")
				.setIcon("file-text")
				.onClick(() => void this.actions.openFlashcardFile());
		});
		menu.addItem((item) => {
			item
				.setTitle("Delete all flashcards")
				.setIcon("trash-2")
				.onClick(() => void this.actions.deleteAllFlashcards());
		});
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (!(container instanceof HTMLElement)) return;
		container.empty();

		this.unmountPreact = mountPreact(
			container,
			this.plugin,
			h(FlashcardPanelApp, {
				onActions: (action: PanelAppActions) => {
					if (action.type === "refresh") {
						void this.loader.load();
					}
				},
			}),
		);

		// Subscribe to store for Obsidian native header actions
		if (this.plugin.store) {
			this.headerActionsUnsub = this.plugin.store.subscribe(
				(s) => ({ status: s.panel.status, file: s.panel.currentFile }),
				() => this.updateHeaderActions(),
				{ equalityFn: shallow },
			);
		}

		this.loader.watchDataChanges(() => this.source.isFollowingReview());
		// Registered through the view so Obsidian drops it on unload.
		this.registerEvent(
			this.app.workspace.on("editor-change", () =>
				this.loader.scheduleNoteScan(),
			),
		);

		await this.source.start();
	}

	onClose(): Promise<void> {
		this.unmountPreact?.();
		this.unmountPreact = null;

		this.source.dispose();
		this.loader.dispose();
		this.headerActionsUnsub?.();
		this.headerActionsUnsub = null;
		this.clearHeaderActions();
		return Promise.resolve();
	}

	// ── Public API used by PluginEventHandlers ─────────────

	handleFileChange(file: TFile | null): Promise<void> {
		return this.source.handleFileChange(file);
	}

	isFollowingReview(): boolean {
		return this.source.isFollowingReview();
	}

	clearReviewFollowState(): void {
		this.source.clearReviewFollowState();
	}

	syncWithReviewState(sourceNotePath: string | null, isActive: boolean): void {
		this.source.syncWithReviewState(sourceNotePath, isActive);
	}

	// ── Header actions ─────────────────────────────────────

	private updateHeaderActions(): void {
		this.clearHeaderActions();

		const state = this.panel;
		const currentFile = state.currentFile;
		if (state.status !== "exists" || !currentFile) return;

		if (!Platform.isMobile) {
			this.headerActionEls.push(
				this.addAction(
					"trash-2",
					"Delete all flashcards",
					() => void this.actions.deleteAllFlashcards(),
				),
				this.addAction(
					"file-text",
					"Open flashcard file",
					() => void this.actions.openFlashcardFile(),
				),
			);
		}

		this.headerActionEls.push(
			this.addAction(
				"brain",
				"Review flashcards",
				() => void this.plugin.reviewNoteFlashcards(currentFile),
			),
		);
	}

	private clearHeaderActions(): void {
		for (const el of this.headerActionEls) el.remove();
		this.headerActionEls = [];
	}
}
