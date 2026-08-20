import { VIEW_TYPE_QUICK_NOTE_EDITOR } from "@true-recall/core/constants";

import { QuickNoteEditorModal } from "@true-recall/obsidian/modals/study/quick-note-editor/QuickNoteEditorModal";
import type {
	QuickNoteEditorMode,
	QuickNoteEditorResult,
} from "@true-recall/obsidian/modals/study/quick-note-editor/types";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { capabilities } from "@true-recall/obsidian/utils/platform";

import type TrueRecallPlugin from "../../main";
import {
	consumeQuickNoteEditorRequest,
	newQuickNoteEditorRequestId,
	registerQuickNoteEditorRequest,
} from "./quick-note-editor-registry";

const POPOUT_WIDTH = 720;
// Open small; QuickNoteEditorView measures content on mount and grows the
// window via win.resizeTo() to fit. Growing up to fit looks smoother than
// opening large and shrinking down.
const POPOUT_HEIGHT = 280;

export function openQuickNoteEditor(
	plugin: TrueRecallPlugin,
	mode: QuickNoteEditorMode,
): Promise<QuickNoteEditorResult> {
	if (!capabilities.canOpenPopout()) {
		return new QuickNoteEditorModal(plugin.app, plugin, mode).openAndWait();
	}

	return new Promise<QuickNoteEditorResult>((resolve) => {
		const requestId = newQuickNoteEditorRequestId();
		registerQuickNoteEditorRequest(requestId, mode, resolve);

		const cleanupOnFailure = (err: unknown) => {
			notify().error("Failed to open the flashcard editor window", err);
			if (consumeQuickNoteEditorRequest(requestId)) {
				resolve({ cancelled: true });
			}
		};

		let leaf: ReturnType<typeof plugin.app.workspace.openPopoutLeaf>;
		try {
			leaf = plugin.app.workspace.openPopoutLeaf({
				size: { width: POPOUT_WIDTH, height: POPOUT_HEIGHT },
			});
		} catch (err) {
			cleanupOnFailure(err);
			return;
		}

		leaf
			.setViewState({
				type: VIEW_TYPE_QUICK_NOTE_EDITOR,
				active: true,
				state: { requestId },
			})
			.catch((err) => {
				cleanupOnFailure(err);
				try {
					leaf.detach();
				} catch {
					// detach is best-effort cleanup
				}
			});
	});
}
