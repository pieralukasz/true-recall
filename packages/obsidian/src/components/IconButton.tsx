import { cva } from "class-variance-authority";
import type { ComponentChildren } from "preact";

import { useIcon } from "@true-recall/obsidian/preact/hooks";
import { cn } from "@true-recall/obsidian/utils/cn";

import { Clickable } from "./Clickable";

interface IconButtonProps {
	icon: string;
	ariaLabel: string;
	onClick: (e: MouseEvent | KeyboardEvent) => void;
	label?: string;
	size?: "small" | "medium";
	danger?: boolean;
	disabled?: boolean;
	class?: string;
	/** Override the Lucide icon with custom SVG content (or any node). */
	customIcon?: ComponentChildren;
}

const iconButtonVariants = cva(
	"clickable-icon ep:cursor-pointer ep:flex ep:items-center ep:justify-center ep:rounded-md ep:text-obs-muted ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal ep:transition-colors",
	{
		variants: {
			size: {
				small: "ep:w-6 ep:h-6 ep:[&_svg]:w-3.5 ep:[&_svg]:h-3.5",
				medium: "",
			},
			danger: {
				true: "ep:hover:text-obs-red",
			},
			disabled: {
				true: "ep:opacity-50 ep:cursor-not-allowed",
			},
			hasLabel: {
				true: "ep:gap-1",
			},
		},
		defaultVariants: { size: "medium" },
	},
);

export function IconButton({
	icon,
	ariaLabel,
	onClick,
	label,
	size = "medium",
	danger = false,
	disabled = false,
	class: cls,
	customIcon,
}: IconButtonProps) {
	const iconRef = useIcon(customIcon ? "" : icon);

	return (
		<Clickable
			class={cn(
				iconButtonVariants({
					size,
					danger,
					disabled,
					hasLabel: !!label,
				}),
				cls,
			)}
			aria-label={ariaLabel}
			disabled={disabled}
			onClick={(e) => onClick(e)}
		>
			{customIcon ? (
				<span class="ep:inline-flex">{customIcon}</span>
			) : (
				<span ref={iconRef} />
			)}
			{label && <span class="ep:text-ui-small">{label}</span>}
		</Clickable>
	);
}
