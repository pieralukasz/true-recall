import { CardAIFieldEditor } from "./CardAIFieldEditor";

interface CardAIFieldProps {
	label: string;
	value: string;
	onChange?: (next: string) => void;
	readOnly?: boolean;
	disabled?: boolean;
}

/**
 * A labelled, embedded-editor card field. Shared by the Card Polish preview
 * modal and the AI Inbox so drafts render identically (CM6 live preview,
 * backlinks, markdown) instead of plain textareas.
 */
export function CardAIField({
	label,
	value,
	onChange,
	readOnly = false,
	disabled = false,
}: CardAIFieldProps) {
	const isReadOnly = readOnly || disabled;
	return (
		<div class={`tr-card-ai-preview-field${disabled ? " is-disabled" : ""}`}>
			<div class="tr-card-ai-preview-field-label">{label}</div>
			<CardAIFieldEditor
				value={value}
				onChange={isReadOnly ? undefined : onChange}
				readOnly={isReadOnly}
				ariaLabel={label}
			/>
		</div>
	);
}
