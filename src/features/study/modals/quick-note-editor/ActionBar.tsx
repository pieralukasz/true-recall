import { NoteTypePicker } from "@features/core/modals/add-flashcards/NoteTypePicker";
import { CardTypesEditorModal } from "@features/core/modals/card-types-editor/CardTypesEditorModal";
import { NoteTypeManagerModal } from "@features/core/modals/NoteTypeManagerModal";
import { Clickable } from "@shared/ui/components/Clickable";
import { NotePickerCombobox } from "@shared/ui/components/NotePickerCombobox";
import { useIcon } from "@shared/ui/preact/hooks";
import type { App, TFile } from "obsidian";
import { Notice } from "obsidian";
import { useCallback } from "preact/hooks";
import type TrueRecallPlugin from "../../../../main";

interface ActionBarProps {
	app: App;
	plugin: TrueRecallPlugin;
	noteTypeId: string;
	onNoteTypeChange: (id: string) => void;
	isEdit: boolean;
	showSourcePicker: boolean;
	selectedSourceNote: TFile | null;
	onSourceSelect: (file: TFile | null) => void;
	onNoteTypeRefresh: () => void;
}

export function ActionBar({
	app,
	plugin,
	noteTypeId,
	onNoteTypeChange,
	isEdit,
	showSourcePicker,
	selectedSourceNote,
	onSourceSelect,
	onNoteTypeRefresh,
}: ActionBarProps) {
	const openFields = useCallback(() => {
		const modal = new NoteTypeManagerModal(app, plugin);
		const origClose = modal.onClose.bind(modal);
		modal.onClose = () => {
			origClose();
			onNoteTypeRefresh();
		};
		modal.open();
	}, [app, plugin, onNoteTypeRefresh]);

	const openCards = useCallback(() => {
		const modal = new CardTypesEditorModal(app, plugin, noteTypeId);
		const origClose = modal.onClose.bind(modal);
		modal.onClose = () => {
			origClose();
			onNoteTypeRefresh();
		};
		modal.open();
	}, [app, plugin, noteTypeId, onNoteTypeRefresh]);

	const aiIconRef = useIcon("wand");

	const openAI = useCallback(() => {
		new Notice("AI generation coming soon");
	}, []);

	const actionBtnCls =
		"ep-btn ep-btn-ghost ep:text-ui-smaller ep:px-2 ep:py-1 ep:min-h-[28px] ep:max-h-[28px]";

	return (
		<div class="ep:flex ep:items-center ep:gap-2 ep:flex-wrap">
			<NoteTypePicker
				value={noteTypeId}
				onChange={onNoteTypeChange}
				disabled={isEdit}
			/>

			{showSourcePicker && (
				<div class="ep:flex-1 ep:min-w-[140px] ep:flex ep:items-center ep:gap-1">
					<div class="ep:flex-1">
						<NotePickerCombobox
							app={app}
							selectedNote={selectedSourceNote}
							onSelect={onSourceSelect}
						/>
					</div>
					{selectedSourceNote && (
						<Clickable
							class="ep:text-ui-smaller ep:text-obs-muted ep:hover:text-obs-normal"
							onClick={() => onSourceSelect(null)}
						>
							Clear
						</Clickable>
					)}
				</div>
			)}

			<div class="ep:flex ep:items-center ep:gap-0.5 ep:ml-auto">
				<Clickable
					class={actionBtnCls}
					onClick={openFields}
					stopPropagation={false}
				>
					Fields
				</Clickable>
				<Clickable
					class={actionBtnCls}
					onClick={openCards}
					stopPropagation={false}
				>
					Cards
				</Clickable>
				<div
					ref={aiIconRef}
					role="button"
					title="Generate with AI (coming soon)"
					class={`${actionBtnCls} [&>svg]:ep:w-4 [&>svg]:ep:h-4`}
					onClick={openAI}
				/>
			</div>
		</div>
	);
}
