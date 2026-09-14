import { Clickable } from "@true-recall/obsidian/components";
import { cn } from "@true-recall/obsidian/utils/cn";

import type { IOEditorController } from "../../hooks/useIOEditorController";

interface IOMaskModeSectionProps {
	maskMode: IOEditorController["maskMode"];
	onChange: IOEditorController["onMaskModeChange"];
}

const BASE_BUTTON_CLASS =
	"ep:px-3 ep:py-1.5 ep:text-ui-small ep:rounded ep:border ep:border-obs-border ep:transition-colors";
const ACTIVE_BUTTON_CLASS =
	"ep:bg-obs-accent/10 ep:text-obs-accent ep:border-obs-accent";
const INACTIVE_BUTTON_CLASS = "ep:text-obs-muted ep:hover:bg-obs-hover";

export function IOMaskModeSection({
	maskMode,
	onChange,
}: IOMaskModeSectionProps) {
	return (
		<section class="true-recall-io-side-section">
			<h3 class="ep:text-ui-small ep:font-medium ep:mb-1">Mask mode</h3>
			<div class="ep:flex ep:gap-2">
				{(["solo", "all"] as const).map((mode) => (
					<Clickable
						key={mode}
						class={cn(
							BASE_BUTTON_CLASS,
							maskMode === mode ? ACTIVE_BUTTON_CLASS : INACTIVE_BUTTON_CLASS,
						)}
						onClick={() => onChange(mode)}
					>
						{mode === "solo" ? "Solo" : "All"}
					</Clickable>
				))}
			</div>
		</section>
	);
}
