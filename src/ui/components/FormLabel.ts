/**
 * FormLabel Component
 * Provides consistent styling for form field labels
 */
import { FORM_LABEL_CLASSES } from "../utils";

export interface FormLabelProps {
	/** Label text */
	text: string;
	/** HTML 'for' attribute to associate with input */
	htmlFor?: string;
	/** Additional CSS classes */
	className?: string;
}

/**
 * Create a form label element with consistent styling
 */
export function createFormLabel(
	container: HTMLElement,
	props: FormLabelProps | string
): HTMLElement {
	// Support simple string usage: createFormLabel(container, "Question")
	const normalizedProps: FormLabelProps =
		typeof props === "string" ? { text: props } : props;

	const { text, htmlFor, className } = normalizedProps;

	const classes = className
		? `${FORM_LABEL_CLASSES} ${className}`
		: FORM_LABEL_CLASSES;

	if (htmlFor) {
		return container.createEl("label", {
			text,
			cls: classes,
			attr: { for: htmlFor },
		});
	}

	return container.createDiv({
		text,
		cls: classes,
	});
}
