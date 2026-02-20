export interface ClickableProps {
	onClick: () => void;
	children: preact.ComponentChildren;
	class?: string;
	"aria-label"?: string;
	disabled?: boolean;
}

export function Clickable({
	onClick,
	children,
	class: cls,
	"aria-label": ariaLabel,
	disabled,
}: ClickableProps) {
	return (
		// biome-ignore lint/a11y/useSemanticElements: intentionally a span, not a button — used for inline clickable wrappers
		<span
			role="button"
			tabIndex={disabled ? -1 : 0}
			aria-label={ariaLabel}
			aria-disabled={disabled}
			class={`ep:cursor-pointer ${disabled ? "ep:opacity-60 ep:cursor-not-allowed" : ""} ${cls ?? ""}`}
			onClick={
				disabled
					? undefined
					: (e) => {
							e.preventDefault();
							e.stopPropagation();
							onClick();
						}
			}
			onKeyDown={
				disabled
					? undefined
					: (e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								e.stopPropagation();
								onClick();
							}
						}
			}
		>
			{children}
		</span>
	);
}
