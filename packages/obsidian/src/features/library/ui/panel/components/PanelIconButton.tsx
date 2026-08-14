import { useIcon } from "@true-recall/obsidian/preact/hooks";
import { cn } from "@true-recall/obsidian/utils";

interface PanelIconButtonProps {
	icon: string;
	label: string;
	onClick: (event: MouseEvent) => void;
	class?: string;
	disabled?: boolean;
	pressed?: boolean;
	title?: string;
	type?: "button" | "submit" | "reset";
}

export function PanelIconButton({
	icon,
	label,
	onClick,
	class: cls,
	disabled = false,
	pressed,
	title,
	type = "button",
}: PanelIconButtonProps) {
	const iconRef = useIcon(icon);
	return (
		<button
			type={type}
			class={cn(
				"tr-panel-icon-button ep:inline-flex ep:w-7 ep:h-7 ep:shrink-0 ep:items-center ep:justify-center ep:rounded-md ep:border-0 ep:bg-transparent ep:text-obs-muted ep:cursor-pointer ep:touch-manipulation ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal ep:disabled:opacity-50 ep:disabled:cursor-not-allowed",
				cls,
			)}
			aria-label={label}
			aria-pressed={pressed}
			disabled={disabled}
			title={title ?? label}
			onClick={onClick}
		>
			<span
				ref={iconRef}
				aria-hidden="true"
				class="ep:inline-flex ep:w-4 ep:h-4"
			/>
		</button>
	);
}
