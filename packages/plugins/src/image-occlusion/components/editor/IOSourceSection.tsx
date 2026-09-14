import { Clickable } from "@true-recall/obsidian/components";
import { NotePickerCombobox } from "@true-recall/obsidian/components/NotePickerCombobox";

import type { IOEditorController } from "../../hooks/useIOEditorController";
import { IconToolButton } from "../IOIconToolButton";

interface IOSourceSectionProps {
	source: IOEditorController["source"];
}

export function IOSourceSection({ source }: IOSourceSectionProps) {
	return (
		<section class="true-recall-io-side-section">
			<h3 class="ep:text-ui-small ep:font-medium ep:mb-1">Source</h3>
			{source.showPicker ? (
				<div class="ep:flex ep:items-center ep:gap-2">
					<div class="ep:flex-1">
						<NotePickerCombobox
							app={source.app}
							selectedNote={source.selectedNote}
							onSelect={source.onSelectNote}
						/>
					</div>
					{source.selectedNote ? (
						<Clickable
							class="ep:text-ui-smaller ep:text-obs-muted ep:hover:text-obs-normal"
							onClick={() => source.onSelectNote(null)}
						>
							Clear
						</Clickable>
					) : null}
				</div>
			) : null}
			<div class="ep:flex ep:items-center ep:gap-2">
				<div
					class="ep:text-ui-smaller ep:text-obs-muted ep:flex-1"
					title={source.label}
				>
					{source.shortLabel}
				</div>
				{source.path ? (
					<IconToolButton
						icon="copy"
						label="Copy source path"
						onClick={() => void source.onCopyPath(source.path)}
					/>
				) : null}
			</div>
		</section>
	);
}
