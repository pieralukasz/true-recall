import type { AssistantContext } from "@true-recall/core/ai/assistant";
import { VIEW_TYPE_ASSISTANT_EDITOR } from "@true-recall/core/constants";

import { openAskAiModal } from "@true-recall/obsidian/features/assistant/ui/AskAiModal";
import type { AIWorkspaceMode } from "@true-recall/obsidian/features/assistant/ui/ai-workspace-modes";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { isMobile } from "@true-recall/obsidian/utils/platform";

import type TrueRecallPlugin from "../../main";
import {
	consumeAssistantEditorRequest,
	newAssistantEditorRequestId,
	registerAssistantEditorRequest,
	type SourceWindowBounds,
} from "./assistant-editor-registry";

const POPOUT_WIDTH = 640;
const POPOUT_HEIGHT = 700;

interface OpenAssistantEditorWindowOptions {
	sourceWindow?: Window;
	initialMode?: AIWorkspaceMode;
	onClose?: () => void;
}

function getSourceBounds(win: Window | undefined): SourceWindowBounds | null {
	if (!win) return null;
	const bounds = {
		x: win.screenX,
		y: win.screenY,
		width: win.outerWidth,
		height: win.outerHeight,
	};
	return Object.values(bounds).every(Number.isFinite) ? bounds : null;
}

/** Opens a contextual AI workspace independently from the flashcard editor.
 * Desktop gets a separate OS popout; mobile falls back to a separate modal. */
export function openAssistantEditorWindow(
	plugin: TrueRecallPlugin,
	context: AssistantContext,
	options: OpenAssistantEditorWindowOptions = {},
): (() => void) | null {
	if (isMobile()) {
		return openAskAiModal(
			plugin,
			context,
			options.onClose,
			options.initialMode,
		);
	}

	const requestId = newAssistantEditorRequestId();
	registerAssistantEditorRequest(
		requestId,
		context,
		getSourceBounds(options.sourceWindow),
		options.initialMode ?? "assistant",
		options.onClose,
	);

	const cleanupOnFailure = (error: unknown) => {
		notify().error("Failed to open the AI window", error);
		consumeAssistantEditorRequest(requestId)?.onClose?.();
	};

	let leaf: ReturnType<typeof plugin.app.workspace.openPopoutLeaf>;
	try {
		leaf = plugin.app.workspace.openPopoutLeaf({
			size: { width: POPOUT_WIDTH, height: POPOUT_HEIGHT },
		});
	} catch (error) {
		cleanupOnFailure(error);
		return null;
	}

	leaf
		.setViewState({
			type: VIEW_TYPE_ASSISTANT_EDITOR,
			active: true,
			state: { requestId },
		})
		.catch((error) => {
			cleanupOnFailure(error);
			try {
				leaf.detach();
			} catch (detachError) {
				console.warn(
					"[true-recall] openAssistantEditorWindow: leaf.detach() failed after setViewState rejection",
					detachError,
				);
			}
		});

	return () => {
		try {
			leaf.detach();
		} catch (error) {
			console.warn(
				"[true-recall] openAssistantEditorWindow: leaf.detach() failed",
				error,
			);
		}
	};
}
