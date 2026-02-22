import type { JSX } from "preact";

export interface ClickableProps
	extends Omit<
		JSX.HTMLAttributes<HTMLDivElement>,
		"role" | "tabIndex" | "onClick"
	> {
	onClick: (e: MouseEvent) => void;
	disabled?: boolean;
}

export function Clickable({
	onClick,
	disabled,
	class: cls,
	children,
	...rest
}: ClickableProps) {
	return (
		// biome-ignore lint/a11y/useSemanticElements: intentionally a div, not a button — used for inline clickable wrappers
		<div
			{...rest}
			role="button"
			tabIndex={disabled ? -1 : 0}
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
		>
			{children}
		</div>
	);
}
