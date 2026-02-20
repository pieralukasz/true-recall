export interface ClickableProps {
	onClick: (e: MouseEvent) => void;
	children: preact.ComponentChildren;
	class?: string;
	"aria-label"?: string;
	disabled?: boolean;
	onPointerDown?: (e: PointerEvent) => void;
	onPointerUp?: (e: PointerEvent) => void;
	onPointerCancel?: (e: PointerEvent) => void;
}

export function Clickable({
	onClick,
	children,
	class: cls,
	"aria-label": ariaLabel,
	disabled,
	onPointerDown,
	onPointerUp,
	onPointerCancel,
}: ClickableProps) {
	return (
		// biome-ignore lint/a11y/useSemanticElements: intentionally a span, not a button — used for inline clickable wrappers
		<div
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
							onClick(e);
						}
			}
			onKeyDown={
				disabled
					? undefined
					: (e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								e.stopPropagation();
								onClick(e as unknown as MouseEvent);
							}
						}
			}
			onPointerDown={disabled ? undefined : onPointerDown}
			onPointerUp={disabled ? undefined : onPointerUp}
			onPointerCancel={disabled ? undefined : onPointerCancel}
		>
			{children}
		</div>
	);
}
