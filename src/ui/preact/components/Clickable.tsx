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
		<button
			type="button"
			aria-label={ariaLabel}
			aria-disabled={disabled}
			disabled={disabled}
			class={`ep:bg-transparent ep:border-none ep:p-0 ep:font-inherit ep:cursor-pointer ${cls ?? ""}`}
			onClick={
				disabled
					? undefined
					: (e) => {
							e.preventDefault();
							e.stopPropagation();
							onClick();
						}
			}
		>
			{children}
		</button>
	);
}
