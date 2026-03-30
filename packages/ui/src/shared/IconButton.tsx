import { cn } from "../utils/cn";
import { useIcon } from "../hooks/use-icon";
import { cva } from "class-variance-authority";
import { Clickable } from "./Clickable";

export interface IconButtonProps {
	icon: string;
	ariaLabel: string;
	onClick: (e: MouseEvent | KeyboardEvent) => void;
	label?: string;
	size?: "small" | "medium";
	danger?: boolean;
	disabled?: boolean;
	class?: string;
}

const iconButtonVariants = cva(
	"clickable-icon ep:cursor-pointer ep:flex ep:items-center ep:justify-center ep:rounded-md ep:text-obs-muted ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal ep:transition-colors",
	{
		variants: {
			size: {
				small: "ep:w-6 ep:h-6 [&_svg]:ep:w-3.5 [&_svg]:ep:h-3.5",
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
}: IconButtonProps) {
	const iconRef = useIcon(icon);

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
			<span ref={iconRef} />
			{label && <span class="ep:text-ui-small">{label}</span>}
		</Clickable>
	);
}
