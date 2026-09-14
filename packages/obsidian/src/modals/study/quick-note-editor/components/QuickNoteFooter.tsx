import type { TFile } from "obsidian";
import { useCallback } from "preact/hooks";

import { Clickable } from "@true-recall/obsidian/components";
import { useIcon } from "@true-recall/obsidian/preact/hooks";
import { isMobile } from "@true-recall/obsidian/utils/platform";

interface QuickNoteFooterProps {
	app: import("obsidian").App;
	isEdit: boolean;
	canSave: boolean;
	saving: boolean;
	requiresSourceNote: boolean;
	sourceNoteFile: TFile | null;
	onSave: () => void;
	onSaveAndClose: () => void;
	onOpenFields: () => void;
	onOpenCards: () => void;
	onAI: () => void;
	aiDisabled: boolean;
	aiTitle: string;
}

const ghostBtnCls =
	"ep-btn ep-btn-ghost ep:text-ui-smaller ep:px-2 ep:py-1 ep:min-h-[28px] ep:max-h-[28px]";

export function QuickNoteFooter({
	app,
	isEdit,
	canSave,
	saving,
	requiresSourceNote,
	sourceNoteFile,
	onSave,
	onSaveAndClose,
	onOpenFields,
	onOpenCards,
	onAI,
	aiDisabled,
	aiTitle,
}: QuickNoteFooterProps) {
	const aiIconRef = useIcon("wand");

	const openNote = useCallback(() => {
		if (sourceNoteFile) {
			void app.workspace.getLeaf("tab").openFile(sourceNoteFile);
		}
	}, [app, sourceNoteFile]);

	return (
		<div class="ep-modal-footer ep:flex ep:items-center ep:gap-2">
			<Clickable
				class={ghostBtnCls}
				onClick={onOpenFields}
				stopPropagation={false}
			>
				Fields
			</Clickable>
			<Clickable
				class={ghostBtnCls}
				onClick={onOpenCards}
				stopPropagation={false}
			>
				Cards
			</Clickable>
			<Clickable
				ref={aiIconRef}
				title={aiTitle}
				class={`${ghostBtnCls} ep:ml-auto ep:[&>svg]:w-4 ep:[&>svg]:h-4`}
				onClick={() => onAI()}
				disabled={aiDisabled}
			/>
			<Clickable
				class={ghostBtnCls}
				onClick={openNote}
				disabled={!sourceNoteFile}
				stopPropagation={false}
			>
				Open note
			</Clickable>
			<Clickable
				class="mod-cta ep-btn ep:text-ui-smaller ep:px-3 ep:py-1 ep:min-h-[28px] ep:max-h-[28px] ep:rounded-md"
				onClick={onSave}
				disabled={!canSave || saving || requiresSourceNote}
				title={requiresSourceNote ? "Select a source note to save" : undefined}
				stopPropagation={false}
			>
				{saving
					? "Saving..."
					: isEdit
						? "Save Changes"
						: isMobile()
							? "Save & add another"
							: "Save"}
			</Clickable>
			{!isEdit && isMobile() ? (
				<Clickable
					class={ghostBtnCls}
					onClick={onSaveAndClose}
					disabled={saving}
					stopPropagation={false}
				>
					Done
				</Clickable>
			) : null}
		</div>
	);
}
