import { effect } from "@preact/signals";
import type { TFile, Vault } from "obsidian";

import type { FlashcardManager } from "@true-recall/core/flashcard/flashcard.service";

import { getDataLayer, Q } from "@true-recall/obsidian/data";
import { extractHighlights } from "@true-recall/obsidian/features/library/ui/panel/utils/highlight-extractor";
import { lastMutation } from "@true-recall/obsidian/services/signals";
import type { PanelApi } from "@true-recall/obsidian/store";

import { shouldReloadPanel } from "./panel-refresh-policy";

/** Delay that coalesces bursts of DataLayer changes into one reload. */
export const DATA_RELOAD_DELAY_MS = 100;
/** Delay after the last keystroke before the note is rescanned. */
export const EDITOR_SCAN_DELAY_MS = 500;

export interface PanelDataLoaderDeps {
	vault: Pick<Vault, "getAbstractFileByPath" | "read">;
	flashcardManager: Pick<FlashcardManager, "hasStore" | "getFlashcardInfo">;
	countUncollected: (content: string) => number;
	getPanel: () => PanelApi;
}

/**
 * Loads flashcard info, uncollected blocks, and highlights for the panel's
 * current file and publishes them to the panel store.
 */
export class PanelDataLoader {
	/** Bumped on dispose so loads still in flight never publish. */
	private epoch = 0;
	private reloadTimer: number | null = null;
	private scanTimer: number | null = null;
	private disposeDataEffect: (() => void) | null = null;

	constructor(private deps: PanelDataLoaderDeps) {}

	private get panel(): PanelApi {
		return this.deps.getPanel();
	}

	/** Reload whenever card metadata or settings change, per the refresh policy. */
	watchDataChanges(isFollowingReview: () => boolean): void {
		this.disposeDataEffect?.();
		const dl = getDataLayer();
		const allMetaSig = dl.signal(Q.ALL_META);
		const settingsSig = dl.signal(Q.SETTINGS);
		this.disposeDataEffect = effect(() => {
			void allMetaSig?.value;
			void settingsSig?.value;
			if (shouldReloadPanel(lastMutation.value, isFollowingReview())) {
				this.scheduleReload();
			}
		});
	}

	scheduleReload(): void {
		if (this.reloadTimer) window.clearTimeout(this.reloadTimer);
		this.reloadTimer = window.setTimeout(() => {
			this.reloadTimer = null;
			void this.load();
		}, DATA_RELOAD_DELAY_MS);
	}

	/** Debounced rescan of the note text after an editor change. */
	scheduleNoteScan(): void {
		if (this.scanTimer) window.clearTimeout(this.scanTimer);
		this.scanTimer = window.setTimeout(() => {
			this.scanTimer = null;
			void this.scanCurrentNote();
		}, EDITOR_SCAN_DELAY_MS);
	}

	async load(): Promise<void> {
		const panel = this.panel;
		const file = panel.currentFile;

		if (panel.selectionMode === "selecting") {
			panel.exitSelectionMode();
		}

		if (!this.deps.flashcardManager.hasStore()) {
			return;
		}

		// Every load supersedes the ones still in flight, including loads that
		// end early below (a non-markdown or deleted note).
		const renderVersion = panel.incrementRenderVersion();
		const epoch = this.epoch;

		if (
			!isMarkdown(file) ||
			!this.deps.vault.getAbstractFileByPath(file.path)
		) {
			this.clearInfo();
			return;
		}

		try {
			const [info, content] = await Promise.all([
				this.deps.flashcardManager.getFlashcardInfo(file.path),
				this.deps.vault.read(file),
			]);

			if (!this.isCurrent(renderVersion, epoch)) return;

			this.panel.setState({
				flashcardInfo: info,
				status: info?.exists ? "exists" : "none",
				sourceNoteName: null,
				uncollectedCount: this.deps.countUncollected(content),
				hasHighlights: hasHighlights(content),
			});
		} catch (error) {
			console.error("Error loading flashcard info:", error);
		}
	}

	private async scanCurrentNote(): Promise<void> {
		const file = this.panel.currentFile;
		if (!isMarkdown(file)) return;
		// The scan does not bump the render version: a full load started
		// meanwhile wins, and a note switch discards the scan.
		const renderVersion = this.panel.renderVersion;
		const epoch = this.epoch;

		try {
			const content = await this.deps.vault.read(file);
			const panel = this.panel;
			if (
				!this.isCurrent(renderVersion, epoch) ||
				panel.currentFile?.path !== file.path
			) {
				return;
			}
			const uncollectedCount = this.deps.countUncollected(content);
			const highlights = hasHighlights(content);

			if (panel.uncollectedCount !== uncollectedCount) {
				panel.setUncollectedInfo(uncollectedCount);
			}
			if (panel.hasHighlights !== highlights) {
				panel.setHasHighlights(highlights);
			}
		} catch {
			// Ignore errors (file might be deleted/moved)
		}
	}

	private isCurrent(renderVersion: number, epoch: number): boolean {
		return epoch === this.epoch && this.panel.isCurrentRender(renderVersion);
	}

	private clearInfo(): void {
		this.panel.setFlashcardInfo(null);
		this.panel.setUncollectedInfo(0);
	}

	dispose(): void {
		this.epoch++;
		this.disposeDataEffect?.();
		this.disposeDataEffect = null;
		if (this.reloadTimer) {
			window.clearTimeout(this.reloadTimer);
			this.reloadTimer = null;
		}
		if (this.scanTimer) {
			window.clearTimeout(this.scanTimer);
			this.scanTimer = null;
		}
	}
}

function isMarkdown(file: TFile | null): file is TFile {
	return file !== null && file.extension === "md";
}

function hasHighlights(content: string): boolean {
	return extractHighlights(content).length > 0;
}
