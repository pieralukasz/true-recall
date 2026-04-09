import type { App } from "obsidian";

import {
	FolderSuggestInput,
	ModalFooter,
	OptionCheckbox,
	StatBadge,
	StatGrid,
} from "@true-recall/obsidian/components";
import type { ImportPreview } from "@true-recall/obsidian/modals/integration/anki-import/types";

export interface PreviewPhaseProps {
	app: App;
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
	app,
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
				{/* AI import temporarily disabled — will be improved in a future release */}
			</div>

			<div class="ep:mb-4">
				<div class="ep:text-ui-small ep:font-medium ep:mb-2">
					Import destination
				</div>
				<FolderSuggestInput
					app={app}
					value={importFolder}
					onChange={onImportFolderChange}
					placeholder="Anki Import"
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
