import type { AssistantContext } from "@true-recall/core/ai/assistant";

import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { isMobile } from "@true-recall/obsidian/utils/platform";
import { openAssistantEditorWindow } from "@true-recall/obsidian/views/modal-window/open-assistant-editor-window";

import { openAskAiModal } from "./AskAiModal";
import {
	type AiSurfaceIntent,
	type AiSurfaceKind,
	entryForSurface,
	resolveAiSurface,
} from "./ai-surface";
import type { AIWorkspaceMode } from "./ai-workspace-modes";
import { openAskAiPopover } from "./openAskAiPopover";
import { readLiveAssistantContext } from "./useLiveAssistantContext";

export interface OpenAiWorkspaceOptions {
	intent: AiSurfaceIntent;
	/** Element or rect to float a fast surface against. */
	anchor?: HTMLElement | DOMRect;
	mode?: AIWorkspaceMode;
	/** Overrides the resolved surface on desktop. */
	prefer?: AiSurfaceKind;
	/** Snapshot context for one-shot surfaces. Omit to read what the user is
	 * looking at right now. */
	context?: AssistantContext;
	sourceWindow?: Window;
	onClose?: () => void;
}

function toRect(anchor: HTMLElement | DOMRect): DOMRect {
	return anchor instanceof DOMRect ? anchor : anchor.getBoundingClientRect();
}

/**
 * The single entry point into the AI workspace. Callers describe *why* they are
 * opening it; this decides where it renders, so no call site hard-codes a modal
 * or a window ever again.
 *
 * Returns a disposer for surfaces that own a transient container, or null for
 * the docked view, which the user closes themselves.
 */
export function openAiWorkspace(
	plugin: TrueRecallPlugin,
	options: OpenAiWorkspaceOptions,
): (() => void) | null {
	const surface = resolveAiSurface({
		intent: options.intent,
		hasAnchor: options.anchor !== undefined,
		isMobile: isMobile(),
		prefer: options.prefer,
	});
	const context = options.context ?? readLiveAssistantContext(plugin);

	if (surface === "docked") {
		void plugin.openAssistantWorkspace(options.mode);
		return null;
	}

	if (surface === "popover" && options.anchor !== undefined) {
		return openAskAiPopover(
			plugin,
			toRect(options.anchor),
			context,
			options.mode,
		);
	}

	if (surface === "popout") {
		return openAssistantEditorWindow(plugin, context, {
			sourceWindow: options.sourceWindow,
			initialMode: options.mode,
			onClose: options.onClose,
		});
	}

	return openAskAiModal(plugin, {
		context,
		entry: entryForSurface(surface, options.intent),
		initialMode: options.mode,
		onClose: options.onClose,
	});
}
