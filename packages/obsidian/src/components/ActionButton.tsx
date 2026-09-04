import { cva } from "class-variance-authority";

import { useIcon } from "@true-recall/obsidian/preact/hooks";
import { cn } from "@true-recall/obsidian/utils/cn";

import { Clickable } from "./Clickable";

type ActionButtonVariant =
	| "primary"
	| "secondary"
	| "danger"
	| "ghost"
	| "outline"
	| "seed";

type ActionButtonSize = "sm" | "md" | "lg";

interface ActionButtonProps {
	label: string;
	onClick?: () => void;
	variant: ActionButtonVariant;
	size?: ActionButtonSize;
	icon?: string;
	disabled?: boolean;
	fullWidth?: boolean;
	class?: string;
}

const actionButtonVariants = cva(
	"tr-action-button ep:inline-flex ep:items-center ep:justify-center ep:gap-1.5 ep:border-none ep:rounded-md ep:cursor-pointer ep:font-medium ep:text-ui-small ep:transition-colors",
	{
		variants: {
			variant: {
				primary: "mod-cta tr-action-button--primary",
				secondary:
					"tr-action-button--secondary ep:bg-obs-border ep:text-obs-normal ep:hover:bg-obs-modifier-hover",
				danger:
					"tr-action-button--danger ep:bg-obs-red ep:text-obs-on-accent ep:hover:bg-obs-red",
				ghost:
					"tr-action-button--ghost ep:bg-transparent ep:text-obs-normal ep:hover:bg-obs-modifier-hover",
				outline:
					"tr-action-button--outline ep:bg-obs-primary ep:text-obs-normal ep:border ep:border-solid ep:border-obs-border ep:hover:bg-obs-modifier-hover",
				seed: "tr-action-button--seed ep:bg-obs-border ep:text-obs-normal ep:font-semibold ep:hover:bg-obs-yellow ep:hover:text-obs-on-accent",
			},
			size: {
				sm: "ep:py-1 ep:px-2 ep:text-ui-smaller",
				md: "ep:py-2 ep:px-4",
				lg: "ep:py-2.5 ep:px-5",
			},
			fullWidth: {
				true: "ep:flex-1 ep:w-full",
			},
			disabled: {
				true: "ep:opacity-60 ep:cursor-not-allowed",
			},
		},
		defaultVariants: { variant: "secondary", size: "md" },
	},
);

export function ActionButton({
	label,
	onClick,
	variant,
	size = "md",
	icon,
	disabled = false,
	fullWidth = false,
	class: cls,
}: ActionButtonProps) {
	const iconRef = useIcon(icon ?? "");

	return (
		<Clickable
			class={cn(
				actionButtonVariants({
					variant,
					size,
					fullWidth,
					disabled,
				}),
				cls,
			)}
			disabled={disabled}
			onClick={() => onClick?.()}
		>
			{icon && <span ref={iconRef} />}
			<span>{label}</span>
		</Clickable>
	);
}
