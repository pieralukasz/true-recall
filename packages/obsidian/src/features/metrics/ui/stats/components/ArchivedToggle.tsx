import { Clickable } from "@true-recall/obsidian/components";
import { cn } from "@true-recall/obsidian/utils/cn";

interface ArchivedToggleProps {
	isActive: boolean;
	onToggle: () => void;
}

const PILL_BASE =
	"ep:px-2.5 ep:py-1 ep:text-xs ep:rounded-md ep:transition-colors";
const PILL_ACTIVE =
	"ep:bg-obs-interactive/15 ep:text-obs-interactive ep:font-medium";
const PILL_INACTIVE =
	"ep:text-obs-muted ep:hover:text-obs-normal ep:bg-obs-modifier-hover";

export function ArchivedToggle({ isActive, onToggle }: ArchivedToggleProps) {
	return (
		<Clickable
			class={cn(PILL_BASE, isActive ? PILL_ACTIVE : PILL_INACTIVE)}
			onClick={onToggle}
			aria-label="Include archived cards in statistics"
			aria-pressed={isActive}
		>
			Archived
			{isActive && (
				<span class="ep:ml-1 ep:text-[10px] ep:opacity-70">&#10003;</span>
			)}
		</Clickable>
	);
}
