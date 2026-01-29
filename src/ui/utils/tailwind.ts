/**
 * Utility for combining Tailwind class names conditionally
 *
 * IMPORTANT: Tailwind scans source files at build time, so class names must be
 * written as complete strings (e.g., "ep:flex" not dynamically generated).
 *
 * Usage:
 *   cn("ep:flex ep:gap-2", isActive && "ep:bg-obs-interactive")
 *   cn("ep:text-obs-normal", { "ep:font-bold": isBold })
 */
export function cn(
	...classes: (string | undefined | null | false | Record<string, boolean | undefined>)[]
): string {
	const result: string[] = [];

	for (const cls of classes) {
		if (!cls) continue;

		if (typeof cls === "string") {
			result.push(cls);
		} else if (typeof cls === "object") {
			// Handle object notation: { "class-name": boolean }
			for (const [key, value] of Object.entries(cls)) {
				if (value) {
					result.push(key);
				}
			}
		}
	}

	return result.join(" ");
}

// ============================================================================
// Reusable CSS Class Constants
// ============================================================================

/** Form input field styling */
export const INPUT_CLASSES =
	"ep:w-full ep:py-2.5 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted";

/** Disabled state for buttons and interactive elements */
export const DISABLED_CLASSES = "ep:opacity-50 ep:cursor-not-allowed";

/** Secondary container (cards, panels) */
export const SECONDARY_CONTAINER_CLASSES =
	"ep:bg-obs-secondary ep:border ep:border-obs-border ep:rounded-md";

/** Modal footer button row */
export const BUTTON_ROW_CLASSES =
	"ep:flex ep:justify-end ep:gap-2 ep:pt-2 ep:border-t ep:border-obs-border";

/** List item row with hover effect */
export const LIST_ITEM_CLASSES =
	"ep:flex ep:items-center ep:gap-3 ep:p-3 ep:border-b ep:border-obs-border ep:hover:bg-obs-modifier-hover ep:cursor-pointer ep:transition-colors ep:last:border-b-0";

/** Form label styling */
export const FORM_LABEL_CLASSES =
	"ep:text-ui-smaller ep:font-medium ep:text-obs-muted ep:mb-1";

/** Error message box */
export const ERROR_BOX_CLASSES =
	"ep:p-3 ep:bg-red-500/10 ep:border ep:border-red-500/30 ep:rounded ep:text-red-500 ep:text-ui-small";

/** Success message box */
export const SUCCESS_BOX_CLASSES =
	"ep:p-3 ep:bg-green-500/10 ep:border ep:border-green-500/30 ep:rounded ep:text-green-500 ep:text-ui-small";

/** Warning message box */
export const WARNING_BOX_CLASSES =
	"ep:p-3 ep:bg-orange-500/10 ep:border ep:border-orange-500/30 ep:rounded ep:text-orange-500 ep:text-ui-small";

/** Info message box */
export const INFO_BOX_CLASSES =
	"ep:p-3 ep:bg-blue-500/10 ep:border ep:border-blue-500/30 ep:rounded ep:text-blue-500 ep:text-ui-small";

/** Secondary button styling */
export const SECONDARY_BUTTON_CLASSES =
	"ep:py-2.5 ep:px-5 ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:rounded-md ep:cursor-pointer ep:font-medium ep:transition-colors ep:hover:bg-obs-modifier-hover";

/** Icon button (transparent background) */
export const ICON_BUTTON_CLASSES =
	"ep:p-1.5 ep:rounded ep:bg-transparent ep:border-none ep:cursor-pointer ep:text-obs-muted ep:hover:text-obs-normal ep:hover:bg-obs-modifier-hover ep:transition-colors";
