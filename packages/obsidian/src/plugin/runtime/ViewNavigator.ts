import {
	VIEW_TYPE_ASSISTANT_INBOX,
	VIEW_TYPE_ASSISTANT_WORKSPACE,
	VIEW_TYPE_CARD_BROWSER,
	VIEW_TYPE_DASHBOARD,
	VIEW_TYPE_FLASHCARD_PANEL,
	VIEW_TYPE_SIMULATOR,
	VIEW_TYPE_STATS,
} from "@true-recall/core/constants";

import type { AIWorkspaceMode } from "@true-recall/obsidian/features/assistant/ui/ai-workspace-modes";
import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { NoteTypeSuggestModal } from "@true-recall/obsidian/modals/core/card-types-editor/NoteTypeSuggestModal";
import { ImportStudioModal } from "@true-recall/obsidian/modals/core/import-studio/ImportStudioModal";
import {
	activateView,
	getView,
} from "@true-recall/obsidian/plugin/ViewActivator";
import { notify } from "@true-recall/obsidian/services/notification.service";
import {
	capabilities,
	isViewAllowedOnCurrentPlatform,
} from "@true-recall/obsidian/utils/platform";
import { openCardTypesEditor as openCardTypesEditorPopout } from "@true-recall/obsidian/views/modal-window/open-card-types-editor";
import { openQuickNoteEditor } from "@true-recall/obsidian/views/modal-window/open-quick-note-editor";

import {
	IOEditorModal,
	type IOEditorMode,
	type IOEditorResult,
} from "@true-recall/plugins/image-occlusion";

export class ViewNavigator {
	constructor(private plugin: TrueRecallPlugin) {}

	async activateView(): Promise<void> {
		await activateView(this.plugin.app, VIEW_TYPE_FLASHCARD_PANEL);
	}

	async openSimulator(): Promise<void> {
		if (!this.ensureViewAvailable(VIEW_TYPE_SIMULATOR)) return;
		await activateView(this.plugin.app, VIEW_TYPE_SIMULATOR, {
			useMainArea: true,
		});
	}

	/** Guard for views that are not registered on this platform. */
	private ensureViewAvailable(viewType: string): boolean {
		if (isViewAllowedOnCurrentPlatform(viewType)) return true;
		notify().warning("This view is available on desktop only.");
		return false;
	}

	async openCardBrowser(opts?: {
		sourceUid?: string;
		orphaned?: boolean;
	}): Promise<void> {
		if (!this.ensureViewAvailable(VIEW_TYPE_CARD_BROWSER)) return;
		const state = opts?.sourceUid
			? { sourceUid: opts.sourceUid }
			: opts?.orphaned
				? { orphaned: true }
				: undefined;

		const existingLeaf = getView(this.plugin.app, VIEW_TYPE_CARD_BROWSER);
		if (existingLeaf) {
			if (state) {
				await existingLeaf.setViewState({
					type: VIEW_TYPE_CARD_BROWSER,
					active: true,
					state,
				});
			}
			void this.plugin.app.workspace.revealLeaf(existingLeaf);
			return;
		}
		await activateView(this.plugin.app, VIEW_TYPE_CARD_BROWSER, {
			useMainArea: true,
			state,
		});
	}

	async openDashboard(): Promise<void> {
		const existingLeaf = getView(this.plugin.app, VIEW_TYPE_DASHBOARD);
		if (existingLeaf) {
			void this.plugin.app.workspace.revealLeaf(existingLeaf);
			return;
		}
		await activateView(this.plugin.app, VIEW_TYPE_DASHBOARD, {
			useMainArea: true,
		});
	}

	async openStats(): Promise<void> {
		const existingLeaf = getView(this.plugin.app, VIEW_TYPE_STATS);
		if (existingLeaf) {
			void this.plugin.app.workspace.revealLeaf(existingLeaf);
			return;
		}
		await activateView(this.plugin.app, VIEW_TYPE_STATS, { useMainArea: true });
	}

	async openAssistantInbox(focusThreadId?: string): Promise<void> {
		if (!this.ensureViewAvailable(VIEW_TYPE_ASSISTANT_INBOX)) return;
		const existingLeaf = getView(this.plugin.app, VIEW_TYPE_ASSISTANT_INBOX);
		if (existingLeaf) {
			void this.plugin.app.workspace.revealLeaf(existingLeaf);
		} else {
			await activateView(this.plugin.app, VIEW_TYPE_ASSISTANT_INBOX, {
				useMainArea: true,
			});
		}
		if (focusThreadId) {
			// Give a freshly-mounted inbox one tick to register its listener.
			window.setTimeout(() => {
				window.dispatchEvent(
					new CustomEvent("true-recall:assistant-focus-thread", {
						detail: { threadId: focusThreadId },
					}),
				);
			}, 50);
		}
	}

	/** Reveals the docked AI workspace, normally in the right sidebar so it can
	 * sit next to a review. */
	async openAssistantWorkspace(mode?: AIWorkspaceMode): Promise<void> {
		if (!this.ensureViewAvailable(VIEW_TYPE_ASSISTANT_WORKSPACE)) return;
		const existingLeaf = getView(
			this.plugin.app,
			VIEW_TYPE_ASSISTANT_WORKSPACE,
		);
		if (existingLeaf) {
			if (mode)
				await existingLeaf.setViewState({
					type: VIEW_TYPE_ASSISTANT_WORKSPACE,
					active: true,
					state: { mode },
				});
			void this.plugin.app.workspace.revealLeaf(existingLeaf);
			return;
		}
		await activateView(this.plugin.app, VIEW_TYPE_ASSISTANT_WORKSPACE, {
			state: mode ? { mode } : undefined,
		});
	}

	openCardTypesEditor(noteTypeId?: string): void {
		if (noteTypeId) {
			openCardTypesEditorPopout(this.plugin, noteTypeId);
			return;
		}
		new NoteTypeSuggestModal(this.plugin.app, this.plugin).open();
	}

	openImportStudio(options?: { defaultNoteTypeId?: string }): void {
		new ImportStudioModal(this.plugin.app, this.plugin, options).open();
	}

	openQuickNoteEditor(defaultNoteTypeId?: string): void {
		void openQuickNoteEditor(this.plugin, {
			mode: "add",
			defaultNoteTypeId,
		});
	}

	async openImageOcclusionEditor(
		mode: IOEditorMode = { mode: "add" },
	): Promise<IOEditorResult> {
		if (!capabilities.canEditImageOcclusion()) {
			notify().warning("Image occlusion editor is available on desktop only.");
			return { cancelled: true };
		}

		const modal = new IOEditorModal(this.plugin.app, this.plugin, mode);
		return await modal.openAndWait();
	}

	async openImageOcclusionEditorForActiveNote(): Promise<IOEditorResult> {
		const activeFile = this.plugin.app.workspace.getActiveFile();
		if (!activeFile || activeFile.extension !== "md") {
			return await this.openImageOcclusionEditor({ mode: "add" });
		}

		try {
			const frontmatterService =
				this.plugin.flashcardManager.getFrontmatterService();
			let sourceUid = await frontmatterService.getSourceNoteUid(
				activeFile.path,
			);
			if (!sourceUid) {
				sourceUid = frontmatterService.generateUid();
				await frontmatterService.setSourceNoteUid(activeFile.path, sourceUid);
			}
			return await this.openImageOcclusionEditor({
				mode: "add",
				sourceUid,
			});
		} catch (error) {
			notify().operationFailed("prepare image occlusion source", error);
			return await this.openImageOcclusionEditor({ mode: "add" });
		}
	}
}
