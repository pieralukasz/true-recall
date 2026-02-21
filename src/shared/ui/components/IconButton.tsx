import { useIcon } from "@shared/ui/preact/hooks";

export interface IconButtonProps {
	icon: string;
	ariaLabel: string;
	onClick: (e: MouseEvent) => void;
	label?: string;
	size?: "small" | "medium";
	danger?: boolean;
	disabled?: boolean;
	class?: string;
}

export function IconButton({
	icon,
	ariaLabel,
	onClick,
	label,
	size = "medium",
	danger = false,
	disabled = false,
	class: cls,
}: IconButtonProps) {
	const iconRef = useIcon(icon);

	const classes = [
		"clickable-icon",
		"ep:cursor-pointer ep:flex ep:items-center ep:justify-center ep:rounded-md",
		"ep:text-obs-muted ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal ep:transition-colors",
		size === "small" ? "ep:w-6 ep:h-6 [&_svg]:ep:w-3.5 [&_svg]:ep:h-3.5" : "",
		label ? "ep:gap-1" : "",
		danger ? "ep:hover:text-obs-red" : "",
		disabled ? "ep:opacity-50 ep:cursor-not-allowed" : "",
		cls ?? "",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<button
			type="button"
			class={classes}
			aria-label={ariaLabel}
			disabled={disabled}
			onClick={
				disabled
					? undefined
					: (e) => {
							e.stopPropagation();
							onClick(e as MouseEvent);
						}
			}
		>
			<span ref={iconRef} />
			{label && <span class="ep:text-ui-small">{label}</span>}
		</button>
	);
}
