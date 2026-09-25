import { TFile, type Vault, type Workspace } from "obsidian";

import type { AppStore, PanelApi } from "@true-recall/obsidian/store";

export interface PanelSourceControllerDeps {
	vault: Pick<Vault, "getAbstractFileByPath">;
	workspace: Pick<Workspace, "getActiveFile" | "getLastOpenFiles">;
	getStore: () => AppStore | null;
	getPanel: () => PanelApi;
	load: () => Promise<void>;
	isMobile: () => boolean;
}

/**
 * Chooses which note the panel shows: the active note, the source of the
 * current review card, or a restored/pinned note on mobile.
 *
 * Transitions:
 * - open: review active → review source; otherwise restored note, then the
 *   active note, then (mobile only) the most recently opened markdown note.
 * - review starts or moves to a card with another source → that source.
 * - review ends, or the card has no existing source note → the active note.
 * - restored view state → that note, unless the panel follows a review.
 * - workspace file change → that file (on mobile a non-file tab keeps the
 *   pinned note).
 */
export class PanelSourceController {
	private lastReviewCardPath: string | null = null;
	private lastReviewActive = false;
	private restoredFilePath: string | null = null;
	private started = false;
	private unsubscribeReview: (() => void) | null = null;

	constructor(private deps: PanelSourceControllerDeps) {}

	private get panel(): PanelApi {
		return this.deps.getPanel();
	}

	/** Subscribe to the review session and select the initial source. */
	async start(): Promise<void> {
		this.started = true;
		this.subscribeToReviewState();

		const review = this.deps.getStore()?.getState()?.review;
		if (review?.isActive) {
			const currentPath = review.getCurrentCard()?.sourceNotePath ?? null;
			this.lastReviewCardPath = currentPath;
			this.lastReviewActive = true;
			void this.syncWithReviewCard(currentPath, true);
		} else {
			await this.loadInitialFile();
		}
	}

	/** Apply a note path from persisted view state. */
	restore(filePath: string): void {
		this.restoredFilePath = filePath;

		// Obsidian calls setState after onOpen, so the restored note usually
		// arrives once the panel already shows a source. Apply it directly,
		// except while the panel follows a review card.
		if (this.started && this.deps.getStore() && !this.isFollowingReview()) {
			const file = this.deps.vault.getAbstractFileByPath(filePath);
			if (file instanceof TFile) {
				void this.handleFileChange(file);
			}
		}
	}

	async handleFileChange(file: TFile | null): Promise<void> {
		const panel = this.panel;

		if (panel.currentFile?.path === file?.path) {
			return;
		}

		// On mobile the panel lives in the main area, so switching to any
		// non-file tab (dashboard, review) makes getActiveFile() return null.
		// Keep the pinned note instead of blanking the list; only an actual
		// new markdown file replaces it.
		if (this.deps.isMobile() && !file && panel.currentFile) {
			return;
		}

		panel.setCurrentFile(file);
		await this.deps.load();
	}

	isFollowingReview(): boolean {
		return this.panel.isFollowingReview;
	}

	clearReviewFollowState(): void {
		this.panel.setReviewFollowState(null, false);
	}

	/** Force a review re-sync (used when the review view regains focus). */
	syncWithReviewState(sourceNotePath: string | null, isActive: boolean): void {
		this.lastReviewCardPath = sourceNotePath;
		this.lastReviewActive = isActive;
		void this.syncWithReviewCard(sourceNotePath, isActive);
	}

	dispose(): void {
		this.started = false;
		this.unsubscribeReview?.();
		this.unsubscribeReview = null;
	}

	private subscribeToReviewState(): void {
		const store = this.deps.getStore();
		if (!store) return;

		this.unsubscribeReview?.();
		this.unsubscribeReview = store.subscribe(
			(state) => state.review,
			() => {
				const review = store.getState().review;
				const currentPath = review.getCurrentCard()?.sourceNotePath ?? null;
				const isActive = review.isActive;

				if (
					currentPath !== this.lastReviewCardPath ||
					isActive !== this.lastReviewActive
				) {
					this.lastReviewCardPath = currentPath;
					this.lastReviewActive = isActive;
					void this.syncWithReviewCard(currentPath, isActive);
				}
			},
		);
	}

	private async syncWithReviewCard(
		sourceNotePath: string | null,
		isActive: boolean,
	): Promise<void> {
		const sourceFile =
			isActive && sourceNotePath
				? this.deps.vault.getAbstractFileByPath(sourceNotePath)
				: null;

		// A card whose source note was deleted or renamed has no source to
		// follow; treat it like a card without a source.
		if (!(sourceFile instanceof TFile)) {
			this.panel.setReviewFollowState(null, isActive);
			await this.handleFileChange(this.deps.workspace.getActiveFile());
			return;
		}

		this.panel.setReviewFollowState(sourceFile.path, true);
		await this.handleFileChange(sourceFile);
	}

	private async loadInitialFile(): Promise<void> {
		const file =
			this.consumeRestoredFile() ??
			this.deps.workspace.getActiveFile() ??
			this.getFallbackFile();
		this.panel.setCurrentFile(file);
		await this.deps.load();
	}

	private consumeRestoredFile(): TFile | null {
		const path = this.restoredFilePath;
		this.restoredFilePath = null;
		if (!path) return null;
		const file = this.deps.vault.getAbstractFileByPath(path);
		return file instanceof TFile ? file : null;
	}

	/**
	 * On mobile the panel usually opens from a non-file context (dashboard,
	 * command palette), where getActiveFile() is null. Fall back to the most
	 * recently opened markdown file so the view is never pointlessly empty.
	 */
	private getFallbackFile(): TFile | null {
		if (!this.deps.isMobile()) return null;
		for (const path of this.deps.workspace.getLastOpenFiles()) {
			const file = this.deps.vault.getAbstractFileByPath(path);
			if (file instanceof TFile && file.extension === "md") {
				return file;
			}
		}
		return null;
	}
}
