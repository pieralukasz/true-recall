import { VIEW_TYPE_NOTE_TYPE_MANAGER } from "@true-recall/core/constants";

import { NoteTypeManagerModal } from "@true-recall/obsidian/modals/core/NoteTypeManagerModal";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { isMobile } from "@true-recall/obsidian/utils/platform";

import type TrueRecallPlugin from "../../main";
import {
	consumeNoteTypeManagerRequest,
	newNoteTypeManagerRequestId,
	registerNoteTypeManagerRequest,
} from "./note-type-manager-registry";

const POPOUT_WIDTH = 880;
const POPOUT_HEIGHT = 720;

export interface OpenNoteTypeManagerOptions {
	onClose?: () => void;
}

export function openNoteTypeManager(
	plugin: TrueRecallPlugin,
	options: OpenNoteTypeManagerOptions = {},
): void {
	if (isMobile()) {
		const modal = new NoteTypeManagerModal(plugin.app, plugin);
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

	const requestId = newNoteTypeManagerRequestId();
	registerNoteTypeManagerRequest(requestId, options.onClose);

	const cleanupOnFailure = (err: unknown) => {
		notify().error("Failed to open the note type manager", err);
		const entry = consumeNoteTypeManagerRequest(requestId);
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
			type: VIEW_TYPE_NOTE_TYPE_MANAGER,
			active: true,
			state: { requestId },
		})
		.catch((err) => {
			cleanupOnFailure(err);
			try {
				leaf.detach();
			} catch (detachErr) {
				console.warn(
					"[true-recall] openNoteTypeManager: leaf.detach() failed after setViewState rejection",
					detachErr,
				);
			}
		});
}
