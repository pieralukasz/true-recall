import { cn } from "@shared/ui/utils";
import type { JSX } from "preact";

export interface ClickableProps
	extends Omit<
		JSX.HTMLAttributes<HTMLDivElement>,
		"role" | "tabIndex" | "onClick"
	> {
	onClick: (e: MouseEvent) => void;
	disabled?: boolean;
	role?: JSX.HTMLAttributes<HTMLDivElement>["role"];
	stopPropagation?: boolean;
	preventDefault?: boolean;
}

export function Clickable({
	onClick,
	disabled,
	role: roleOverride,
	stopPropagation: stop = true,
	preventDefault: prevent = true,
	class: cls,
	children,
	...rest
}: ClickableProps) {
	const handleClick = disabled
		? undefined
		: (e: MouseEvent) => {
				if (prevent) e.preventDefault();
				if (stop) e.stopPropagation();
				onClick(e);
			};

	const handleKeyDown = disabled
		? undefined
		: (e: KeyboardEvent) => {
				if (e.key === "Enter" || e.key === " ") {
					if (prevent) e.preventDefault();
					if (stop) e.stopPropagation();
					onClick(e as unknown as MouseEvent);
				}
			};

	return (
		// biome-ignore lint/a11y/useSemanticElements: intentionally a div, not a button — avoids Obsidian's aggressive native button styling
		<div
			{...rest}
			role={roleOverride ?? "button"}
			tabIndex={disabled ? -1 : 0}
			aria-disabled={disabled || undefined}
			class={cn(
				"ep:cursor-pointer",
				disabled && "ep:opacity-60 ep:cursor-not-allowed",
				cls,
			)}
			onClick={handleClick}
			onKeyDown={handleKeyDown}
		>
			{children}
		</div>
	);
}
