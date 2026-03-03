import { Clickable } from "@shared/ui/components/Clickable";
import { useIcon } from "@shared/ui/preact/hooks";
import { cn } from "@shared/ui/utils";
import { cva } from "class-variance-authority";

export type ActionButtonVariant = "primary" | "secondary" | "danger" | "seed";

export interface ActionButtonProps {
	label: string;
	onClick?: () => void;
	variant: ActionButtonVariant;
	icon?: string;
	disabled?: boolean;
	fullWidth?: boolean;
	class?: string;
}

const actionButtonVariants = cva(
	"ep:border-none ep:py-2 ep:px-4 ep:rounded-md ep:cursor-pointer ep:font-medium ep:text-ui-small ep:transition-colors",
	{
		variants: {
			variant: {
				primary: "mod-cta",
				secondary:
					"ep:bg-obs-border ep:text-obs-normal ep:hover:bg-obs-modifier-hover",
				danger: "ep:bg-obs-red ep:text-obs-on-accent ep:hover:bg-obs-red",
				seed: "ep:bg-obs-border ep:text-obs-normal ep:font-semibold ep:hover:bg-obs-yellow ep:hover:text-obs-on-accent",
			},
			fullWidth: {
				true: "ep:flex-1",
			},
			disabled: {
				true: "ep:opacity-60 ep:cursor-not-allowed",
			},
			hasIcon: {
				true: "ep:flex ep:items-center ep:gap-1.5 ep:justify-center",
			},
		},
		defaultVariants: { variant: "secondary" },
	},
);

export function ActionButton({
	label,
	onClick,
	variant,
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
					fullWidth,
					disabled,
					hasIcon: !!icon,
				}),
				cls,
			)}
			disabled={disabled}
			onClick={() => onClick?.()}
		>
			{iconRef && <span ref={iconRef} />}
			<span>{label}</span>
		</Clickable>
	);
}
