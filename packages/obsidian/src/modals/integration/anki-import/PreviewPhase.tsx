import {
	FolderPicker,
	ModalFooter,
	OptionCheckbox,
	StatBadge,
	StatGrid,
} from "@true-recall/obsidian/components";
import type { ImportPreview } from "@true-recall/obsidian/modals/integration/anki-import/types";
import { useCallback } from "preact/hooks";

export interface PreviewPhaseProps {
	preview: ImportPreview;
	importScheduling: boolean;
	importMedia: boolean;
	useAI: boolean;
	hasAIKey: boolean;
	importFolder: string;
	onSchedulingChange: (val: boolean) => void;
	onMediaChange: (val: boolean) => void;
	onUseAIChange: (val: boolean) => void;
	onImportFolderChange: (val: string) => void;
	onContinue: () => void;
	onCancel: () => void;
}

export function PreviewPhase({
	preview,
	importScheduling,
	importMedia,
	useAI,
	hasAIKey,
	importFolder,
	onSchedulingChange,
	onMediaChange,
	onUseAIChange,
	onImportFolderChange,
	onContinue,
	onCancel,
}: PreviewPhaseProps) {
	const handleFolderChange = useCallback(
		(folders: string[]) => {
			onImportFolderChange(folders[0] ?? "Anki Import");
		},
		[onImportFolderChange],
	);
	return (
		<>
			<StatGrid columns={2}>
				<StatBadge label="Basic" count={preview.basicCards} />
				<StatBadge label="Cloze" count={preview.clozeCards} />
				<StatBadge label="Reversed" count={preview.reversedCards} />
				<StatBadge label="Media files" count={preview.mediaCount} />
			</StatGrid>

			{preview.decks.length > 0 && (
				<div class="ep:mb-4 ep:mt-4">
					<div class="ep:text-ui-small ep:font-medium ep:mb-2">Decks:</div>
					<div class="ep:border ep:border-obs-border ep:rounded-md ep:max-h-[120px] ep:overflow-y-auto ep:p-2">
						{preview.decks.map((deck) => (
							<div
								key={deck}
								class="ep:text-ui-smaller ep:text-obs-muted ep:py-0.5"
							>
								{deck}
							</div>
						))}
					</div>
				</div>
			)}

			<div class="ep:mb-4">
				<div class="ep:text-ui-small ep:font-medium ep:mb-2">Options</div>
				<OptionCheckbox
					label="Import scheduling data"
					description="Replay review history to preserve your progress"
					checked={importScheduling}
					onChange={onSchedulingChange}
				/>
				<OptionCheckbox
					label="Import media files"
					description={`${preview.mediaCount} files will be saved to Attachments/${importFolder}`}
					checked={importMedia}
					onChange={onMediaChange}
				/>
				<OptionCheckbox
					label="Organize with AI"
					description={
						hasAIKey
							? "Classify cards into sub-decks and clean up formatting"
							: "Requires API key — configure in settings"
					}
					checked={useAI}
					onChange={onUseAIChange}
					disabled={!hasAIKey}
				/>
			</div>

			<div class="ep:mb-4">
				<div class="ep:text-ui-small ep:font-medium ep:mb-2">
					Import destination
				</div>
				<FolderPicker
					value={[importFolder]}
					onChange={handleFolderChange}
					placeholder="Anki Import"
					single
				/>
			</div>

			<ModalFooter
				onCancel={onCancel}
				onConfirm={onContinue}
				confirmLabel="Continue"
			/>
		</>
	);
}
