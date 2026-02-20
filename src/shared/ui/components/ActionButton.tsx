import { useIcon } from "../preact/hooks";

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

const VARIANT_CLASSES: Record<ActionButtonVariant, string> = {
	primary: "mod-cta",
	secondary:
		"ep:bg-obs-border ep:text-obs-normal ep:hover:bg-obs-modifier-hover",
	danger: "ep:bg-obs-red ep:text-obs-on-accent ep:hover:bg-obs-red",
	seed: "ep:bg-obs-border ep:text-obs-normal ep:font-semibold ep:hover:bg-obs-yellow ep:hover:text-obs-on-accent",
};

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

	const classes = [
		"ep:border-none ep:py-2.5 ep:px-4 ep:rounded-md ep:cursor-pointer ep:font-medium ep:text-ui-small ep:transition-colors",
		icon ? "ep:flex ep:items-center ep:gap-1.5 ep:justify-center" : "",
		fullWidth ? "ep:flex-1" : "",
		disabled ? "ep:opacity-60 ep:cursor-not-allowed" : "",
		VARIANT_CLASSES[variant],
		cls ?? "",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<button
			type="button"
			class={classes}
			disabled={disabled}
			onClick={
				disabled
					? undefined
					: (e) => {
							e.stopPropagation();
							onClick?.();
						}
			}
		>
			{iconRef && <span ref={iconRef} />}
			<span>{label}</span>
		</button>
	);
}
