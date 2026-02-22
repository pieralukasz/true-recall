import type { ImportPreview } from "@features/integration/modals/anki-import/types";
import { ModalFooter } from "@shared/ui/components/ModalFooter";
import { OptionCheckbox } from "@shared/ui/components/OptionCheckbox";
import { StatBadge, StatGrid } from "@shared/ui/components/StatBadge";

export interface PreviewPhaseProps {
	preview: ImportPreview;
	importScheduling: boolean;
	importMedia: boolean;
	onSchedulingChange: (val: boolean) => void;
	onMediaChange: (val: boolean) => void;
	onImport: () => void;
	onCancel: () => void;
}

export function PreviewPhase({
	preview,
	importScheduling,
	importMedia,
	onSchedulingChange,
	onMediaChange,
	onImport,
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
					initialChecked={importScheduling}
					onChange={onSchedulingChange}
				/>
				<OptionCheckbox
					label="Import media files"
					description={`${preview.mediaCount} files will be saved to Attachments/anki-import`}
					initialChecked={importMedia}
					onChange={onMediaChange}
				/>
			</div>

			<ModalFooter
				onCancel={onCancel}
				onConfirm={onImport}
				confirmLabel="Import"
			/>
		</>
	);
}
