import { Clickable } from "@true-recall/obsidian/components";
import { cn } from "@true-recall/ui/utils/cn";

interface BottomBarProps {
	readOnly: boolean;
	showFields: boolean;
	onToggleFields: () => void;
	onFlip: () => void;
	onClose: () => void;
}

export function BottomBar({
	readOnly,
	showFields,
	onToggleFields,
	onFlip,
	onClose,
}: BottomBarProps) {
	return (
		<div class="ep:flex ep:items-center ep:gap-2 ep:pt-3 ep:border-t ep:border-obs-border">
			{/* Left group */}
			<div class="ep:flex ep:items-center ep:gap-2">
				{!readOnly && (
					<>
						<Clickable
							class={cn(
								"ep:px-3 ep:py-1.5 ep:text-ui-small ep:rounded ep:border ep:border-obs-border ep:transition-colors",
								showFields
									? "ep:bg-obs-accent/10 ep:text-obs-accent ep:border-obs-accent"
									: "ep:text-obs-muted ep:hover:bg-obs-hover",
							)}
							onClick={onToggleFields}
						>
							Fields {showFields ? "▴" : "▾"}
						</Clickable>
						<Clickable
							class="ep:px-3 ep:py-1.5 ep:text-ui-small ep:text-obs-muted ep:rounded ep:border ep:border-obs-border ep:hover:bg-obs-hover ep:transition-colors"
							onClick={onFlip}
						>
							Flip
						</Clickable>
					</>
				)}
				{readOnly && (
					<span class="ep:text-ui-smaller ep:text-obs-muted ep:italic">
						Built-in note type (read-only)
					</span>
				)}
			</div>

			{/* Spacer */}
			<div class="ep:flex-1" />

			{/* Right group */}
			<Clickable
				class="ep:px-4 ep:py-1.5 ep:text-ui-small ep:text-obs-muted ep:hover:text-obs-normal ep:rounded ep:transition-colors"
				onClick={onClose}
			>
				Close
			</Clickable>
		</div>
	);
}
