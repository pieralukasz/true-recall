import type { AnkiImportResult } from "@true-recall/core/types";
import {
	ModalFooter,
	StatBadge,
	StatGrid,
} from "@true-recall/obsidian/components";

export interface ResultPhaseProps {
	result: AnkiImportResult;
	onClose: () => void;
}

export function ResultPhase({ result, onClose }: ResultPhaseProps) {
	return (
		<>
			<div class="ep:mb-4">
				<StatGrid columns={2}>
					<StatBadge label="Imported" count={result.imported} />
					<StatBadge label="Duplicates" count={result.duplicates} />
					<StatBadge label="Skipped" count={result.skipped} />
					<StatBadge label="Errors" count={result.errors.length} />
				</StatGrid>

				{result.fieldsDropped > 0 && (
					<div class="ep:text-ui-smaller ep:text-obs-muted ep:mt-2">
						{result.fieldsDropped} field{result.fieldsDropped !== 1 ? "s" : ""}{" "}
						dropped during remapping (marked as skip)
					</div>
				)}

				{result.errors.length > 0 && (
					<div class="ep:mb-3">
						<div class="ep:text-ui-small ep:font-medium ep:mb-1 ep:text-red-500">
							Errors:
						</div>
						<div class="ep:border ep:border-obs-border ep:rounded-md ep:max-h-[100px] ep:overflow-y-auto ep:p-2">
							{result.errors.slice(0, 20).map((err, i) => (
								<div
									key={i}
									class="ep:text-ui-smaller ep:text-obs-muted ep:py-0.5"
								>
									{err}
								</div>
							))}
							{result.errors.length > 20 && (
								<div class="ep:text-ui-smaller ep:text-obs-muted ep:italic">
									...and {result.errors.length - 20} more
								</div>
							)}
						</div>
					</div>
				)}
			</div>
			<ModalFooter onCancel={onClose} cancelLabel="Done" />
		</>
	);
}
