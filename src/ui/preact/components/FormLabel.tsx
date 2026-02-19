import { FORM_LABEL_CLASSES } from "../../utils";

export interface FormLabelProps {
	text: string;
	htmlFor?: string;
	class?: string;
}

export function FormLabel({ text, htmlFor, class: cls }: FormLabelProps) {
	const classes = cls ? `${FORM_LABEL_CLASSES} ${cls}` : FORM_LABEL_CLASSES;
	if (htmlFor) {
		return (
			<label class={classes} for={htmlFor}>
				{text}
			</label>
		);
	}
	return <div class={classes}>{text}</div>;
}
