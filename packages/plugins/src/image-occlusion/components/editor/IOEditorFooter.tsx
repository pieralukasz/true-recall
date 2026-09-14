import { Clickable } from "@true-recall/obsidian/components";

import type { IOEditorController } from "../../hooks/useIOEditorController";

interface IOEditorFooterProps {
	isEdit: boolean;
	saving: boolean;
	onCancel: IOEditorController["onCancel"];
	onSave: IOEditorController["onSave"];
}

export function IOEditorFooter({
	isEdit,
	saving,
	onCancel,
	onSave,
}: IOEditorFooterProps) {
	return (
		<footer class="ep-modal-footer true-recall-io-footer ep:flex ep:justify-end ep:gap-2">
			<Clickable
				class="ep:px-3 ep:py-1.5 ep:text-ui-small ep:border ep:border-obs-border ep:rounded ep:text-obs-muted ep:hover:bg-obs-hover ep:hover:text-obs-normal ep:transition-colors"
				onClick={onCancel}
			>
				Cancel
			</Clickable>
			<Clickable
				class="mod-cta ep-btn"
				onClick={() => void onSave()}
				disabled={saving}
			>
				{isEdit ? "Save changes" : "Create cards"}
			</Clickable>
		</footer>
	);
}
