/**
 * Badge Component
 * Provides styled badges for status indicators, counts, and labels
 */

export type BadgeVariant = "default" | "success" | "warning" | "error" | "info" | "new" | "learning" | "review";
export type BadgeSize = "sm" | "md";

export interface BadgeProps {
	/** Badge text */
	text: string;
	/** Visual variant */
	variant?: BadgeVariant;
	/** Size variant */
	size?: BadgeSize;
	/** Additional CSS classes */
	className?: string;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
	default: "ep:bg-obs-secondary ep:text-obs-muted",
	success: "ep:bg-green-500/15 ep:text-green-500",
	warning: "ep:bg-orange-500/15 ep:text-orange-500",
	error: "ep:bg-red-500/15 ep:text-red-500",
	info: "ep:bg-blue-500/15 ep:text-blue-500",
	// FSRS-specific variants
	new: "ep:bg-blue-500/15 ep:text-blue-500",
	learning: "ep:bg-orange-500/15 ep:text-orange-500",
	review: "ep:bg-green-500/15 ep:text-green-500",
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
	sm: "ep:text-ui-smaller ep:py-0.5 ep:px-1.5",
	md: "ep:text-ui-small ep:py-0.5 ep:px-2",
};

/**
 * Create a badge element with consistent styling
 */
export function createBadge(
	container: HTMLElement,
	props: BadgeProps
): HTMLSpanElement {
	const { text, variant = "default", size = "md", className } = props;

	const baseClasses = "ep:rounded ep:font-medium ep:inline-block";
	const variantClasses = VARIANT_CLASSES[variant];
	const sizeClasses = SIZE_CLASSES[size];

	const classes = [baseClasses, variantClasses, sizeClasses, className]
		.filter(Boolean)
		.join(" ");

	return container.createSpan({
		text,
		cls: classes,
	});
}

/**
 * Chip Component
 * Interactive pill-shaped element for filters, tags, etc.
 */
export interface ChipProps {
	/** Chip text */
	text: string;
	/** Whether the chip is selected/active */
	isActive?: boolean;
	/** Click handler */
	onClick?: () => void;
	/** Additional CSS classes */
	className?: string;
}

const CHIP_BASE_CLASSES =
	"ep:py-1 ep:px-2.5 ep:text-ui-smaller ep:border ep:rounded-xl ep:cursor-pointer ep:transition-all";
const CHIP_INACTIVE_CLASSES =
	"ep:border-obs-border ep:bg-obs-primary ep:text-obs-muted ep:hover:border-obs-interactive ep:hover:text-obs-normal";
const CHIP_ACTIVE_CLASSES =
	"ep:border-obs-interactive ep:bg-obs-interactive/10 ep:text-obs-interactive";

/**
 * Create a chip element (interactive pill)
 */
export function createChip(
	container: HTMLElement,
	props: ChipProps
): HTMLSpanElement {
	const { text, isActive = false, onClick, className } = props;

	const stateClasses = isActive ? CHIP_ACTIVE_CLASSES : CHIP_INACTIVE_CLASSES;
	const classes = [CHIP_BASE_CLASSES, stateClasses, className]
		.filter(Boolean)
		.join(" ");

	const chip = container.createSpan({
		text,
		cls: classes,
	});

	if (onClick) {
		chip.addEventListener("click", onClick);
	}

	return chip;
}
