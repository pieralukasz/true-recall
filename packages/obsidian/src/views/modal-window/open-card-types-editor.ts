import { VIEW_TYPE_CARD_TYPES_EDITOR } from "@true-recall/core/constants";

import { CardTypesEditorModal } from "@true-recall/obsidian/modals/core/card-types-editor/CardTypesEditorModal";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { capabilities } from "@true-recall/obsidian/utils/platform";

import type TrueRecallPlugin from "../../main";
import {
	consumeCardTypesEditorRequest,
	newCardTypesEditorRequestId,
	registerCardTypesEditorRequest,
} from "./card-types-editor-registry";

const POPOUT_WIDTH = 1120;
const POPOUT_HEIGHT = 800;

export interface OpenCardTypesEditorOptions {
	onClose?: () => void;
}

export function openCardTypesEditor(
	plugin: TrueRecallPlugin,
	noteTypeId: string,
	options: OpenCardTypesEditorOptions = {},
): void {
	if (!capabilities.canOpenPopout()) {
		const modal = new CardTypesEditorModal(plugin.app, plugin, noteTypeId);
		if (options.onClose) {
			const origClose = modal.onClose.bind(modal);
			modal.onClose = () => {
				origClose();
				options.onClose?.();
			};
		}
		modal.open();
		return;
	}

	const requestId = newCardTypesEditorRequestId();
	registerCardTypesEditorRequest(requestId, noteTypeId, options.onClose);

	// If open fails, consume the registry entry AND fire its onClose so callers
	// never silently hang. Without firing, callers like QuickNoteEditorApp's
	// `handleNoteTypeRefresh` would never re-render.
	const cleanupOnFailure = (err: unknown) => {
		notify().error("Failed to open the card types editor", err);
		const entry = consumeCardTypesEditorRequest(requestId);
		entry?.onClose?.();
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
			type: VIEW_TYPE_CARD_TYPES_EDITOR,
			active: true,
			state: { requestId },
		})
		.catch((err) => {
			cleanupOnFailure(err);
			try {
				leaf.detach();
			} catch (detachErr) {
				console.warn(
					"[true-recall] openCardTypesEditor: leaf.detach() failed after setViewState rejection",
					detachErr,
				);
			}
		});
}
