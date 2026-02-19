export type BadgeVariant =
	| "default"
	| "success"
	| "warning"
	| "error"
	| "info"
	| "new"
	| "learning"
	| "review";
export type BadgeSize = "sm" | "md";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
	default: "ep:bg-obs-secondary ep:text-obs-muted",
	success: "ep:bg-obs-green/15 ep:text-obs-green",
	warning: "ep:bg-obs-orange/15 ep:text-obs-orange",
	error: "ep:bg-obs-red/15 ep:text-obs-red",
	info: "ep:bg-obs-blue/15 ep:text-obs-blue",
	new: "ep:bg-obs-green/15 ep:text-obs-green",
	learning: "ep:bg-obs-orange/15 ep:text-obs-orange",
	review: "ep:bg-obs-blue/15 ep:text-obs-blue",
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
	sm: "ep:text-ui-smaller ep:py-1 ep:px-2",
	md: "ep:text-ui-small ep:py-1 ep:px-2",
};

export interface BadgeProps {
	text: string;
	variant?: BadgeVariant;
	size?: BadgeSize;
	class?: string;
}

export function Badge({
	text,
	variant = "default",
	size = "md",
	class: cls,
}: BadgeProps) {
	return (
		<span
			class={`ep:rounded ep:font-medium ep:inline-block ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${cls ?? ""}`}
		>
			{text}
		</span>
	);
}

const CHIP_BASE =
	"ep:py-1 ep:px-2.5 ep:text-ui-smaller ep:border ep:rounded-xl ep:cursor-pointer ep:transition-all";
const CHIP_INACTIVE =
	"ep:border-obs-border ep:bg-obs-primary ep:text-obs-muted ep:hover:border-obs-interactive ep:hover:text-obs-normal";
const CHIP_ACTIVE =
	"ep:border-obs-interactive ep:bg-obs-interactive/10 ep:text-obs-interactive";

export interface ChipProps {
	text: string;
	isActive?: boolean;
	onClick?: () => void;
	class?: string;
}

export function Chip({
	text,
	isActive = false,
	onClick,
	class: cls,
}: ChipProps) {
	const classes = `${CHIP_BASE} ${isActive ? CHIP_ACTIVE : CHIP_INACTIVE} ${cls ?? ""}`;
	if (onClick) {
		return (
			<button type="button" class={classes} onClick={onClick}>
				{text}
			</button>
		);
	}
	return <span class={classes}>{text}</span>;
}
