import { useCallback, useState } from "preact/hooks";

import { confirm } from "@true-recall/obsidian/modals/shared/ConfirmModal";
import { QuickNoteEditorApp } from "@true-recall/obsidian/modals/study/quick-note-editor/QuickNoteEditorApp";
import { useApp } from "@true-recall/obsidian/preact";

import {
	createQuickAddPanelMode,
	needsQuickAddDiscardConfirmation,
} from "../quick-add-panel";

interface QuickAddPanelProps {
	sourceUid: string | undefined;
	onClose: () => void;
}

export function QuickAddPanel({ sourceUid, onClose }: QuickAddPanelProps) {
	const app = useApp();
	const [isDirty, setIsDirty] = useState(false);
	const [isConfirmingClose, setIsConfirmingClose] = useState(false);
	const [mode] = useState(() => createQuickAddPanelMode(sourceUid));
	const requestClose = useCallback(async () => {
		if (isConfirmingClose) return;
		if (!needsQuickAddDiscardConfirmation(isDirty)) {
			onClose();
			return;
		}
		setIsConfirmingClose(true);
		try {
			const confirmed = await confirm(app, {
				title: "Discard changes?",
				message: "You have unsaved content that will be lost.",
				confirmLabel: "Discard",
			});
			if (confirmed) onClose();
		} finally {
			setIsConfirmingClose(false);
		}
	}, [app, isConfirmingClose, isDirty, onClose]);

	return (
		<section class="tr-panel-quick-add ep:mx-2 ep:mt-2 ep:rounded-md ep:border ep:border-obs-border ep:bg-surface-raised ep:shrink-0">
			<div class="ep:flex ep:items-center ep:justify-between ep:px-3 ep:py-2 ep:border-b ep:border-obs-border">
				<h3 class="ep:m-0 ep:text-ui-small ep:font-semibold ep:text-obs-normal">
					Quick add
				</h3>
				<button
					type="button"
					class="tr-panel-quick-add__close"
					onClick={() => void requestClose()}
					aria-label="Close quick add"
					title="Close quick add"
				>
					×
				</button>
			</div>
			<div class="ep:p-3 ep:max-h-[min(60vh,560px)] ep:overflow-y-auto">
				<QuickNoteEditorApp
					mode={mode}
					onRequestClose={() => void requestClose()}
					onDirtyChange={setIsDirty}
					onDone={onClose}
				/>
			</div>
		</section>
	);
}
