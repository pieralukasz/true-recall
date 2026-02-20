import type { SessionPreset } from "@shared/types/settings.types";

interface SavedPresetsProps {
	presets: SessionPreset[];
	onAction: (p: SessionPreset) => void;
	onDelete: (id: string) => void;
}

export function SavedPresets({
	presets,
	onAction,
	onDelete,
}: SavedPresetsProps) {
	return (
		<>
			<div class="ep:flex ep:items-center ep:justify-between ep:my-2">
				<div class="ep:text-ui-small ep:font-semibold ep:text-obs-normal">
					Saved presets
				</div>
			</div>
			<div class="true-recall-saved-presets ep:flex ep:flex-col ep:gap-1.5">
				{presets.map((preset) => {
					const details: string[] = [];
					if (preset.crammingMode) details.push("cram");
					if (preset.stateFilter) details.push(preset.stateFilter);
					if (preset.reviewOrder && preset.reviewOrder !== "due-date")
						details.push(preset.reviewOrder);
					if (preset.cardLimit) details.push(`limit ${preset.cardLimit}`);

					return (
						<button
							type="button"
							key={preset.id}
							class="ep:flex ep:items-center ep:gap-2 ep:px-3 ep:py-2 ep:bg-obs-secondary ep:border ep:border-obs-border ep:rounded-md ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover ep:hover:border-obs-interactive ep:group ep:font-inherit ep:text-left ep:w-full"
							onClick={(e) => {
								if ((e.target as HTMLElement).tagName !== "BUTTON")
									onAction(preset);
							}}
						>
							<div class="ep:flex-1 ep:min-w-0">
								<span class="ep:text-ui-small ep:font-medium ep:text-obs-normal">
									{preset.name}
								</span>
								{details.length > 0 && (
									<span class="ep:text-ui-smaller ep:text-obs-muted ep:ml-2">
										{details.join(" \u00b7 ")}
									</span>
								)}
							</div>
							<button
								type="button"
								class="ep:text-ui-smaller ep:text-obs-faint ep:bg-transparent ep:border-none ep:cursor-pointer ep:hover:text-obs-red ep:opacity-0 ep:group-hover:opacity-100 ep:px-1"
								aria-label="Delete preset"
								onClick={(e) => {
									e.stopPropagation();
									onDelete(preset.id);
								}}
							>
								&times;
							</button>
						</button>
					);
				})}
			</div>
		</>
	);
}
