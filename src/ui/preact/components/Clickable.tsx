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
		<span
			role="button"
			tabIndex={disabled ? -1 : 0}
			aria-label={ariaLabel}
			aria-disabled={disabled}
			class={cls}
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
