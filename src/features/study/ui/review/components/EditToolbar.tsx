import type {
	ToolbarButton,
	ToolbarButtonAction,
} from "@features/study/ui/editor/edit-toolbar.utils";

export function EditToolbar({
	buttons,
	onAction,
}: {
	buttons: ToolbarButton[];
	onAction: (action: ToolbarButtonAction) => void;
}) {
	return (
		<div class="true-recall-edit-toolbar ep:flex ep:flex-wrap ep:justify-center ep:gap-1 ep:py-2 ep:border-t ep:border-obs-border ep:absolute ep:left-0 ep:right-0 ep:top-full ep:mt-1 ep:z-10">
			{buttons.map((btn) => {
				const title = btn.shortcut
					? `${btn.title} (${btn.shortcut})`
					: btn.title;
				return (
					// biome-ignore lint/a11y/useSemanticElements: toolbar buttons need tabIndex=-1 to prevent focus steal
					// biome-ignore lint/a11y/useKeyWithClickEvents: toolbar buttons use tabIndex=-1 and mouse-only interaction
					<div
						role="button"
						key={btn.id}
						class="ep:px-2 ep:py-1 ep:text-ui-smaller ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:rounded-md ep:cursor-pointer ep:hover:bg-obs-modifier-hover ep:hover:border-obs-interactive ep:transition-colors"
						title={title}
						aria-label={title}
						tabIndex={-1}
						onMouseDown={(e: MouseEvent) => e.preventDefault()}
						onClick={(e: MouseEvent) => {
							e.preventDefault();
							onAction(btn.action);
						}}
					>
						{btn.label}
					</div>
				);
			})}
		</div>
	);
}
