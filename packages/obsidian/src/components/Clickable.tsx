import type { JSX } from "preact";
import { forwardRef } from "preact/compat";

import { cn } from "@true-recall/obsidian/utils/cn";

interface ClickableProps
	extends Omit<
		JSX.HTMLAttributes<HTMLDivElement>,
		"role" | "tabIndex" | "onClick"
	> {
	onClick: (e: MouseEvent | KeyboardEvent) => void;
	disabled?: boolean;
	role?: JSX.HTMLAttributes<HTMLDivElement>["role"];
	stopPropagation?: boolean;
	preventDefault?: boolean;
}

export const Clickable = forwardRef<HTMLDivElement, ClickableProps>(
	function Clickable(
		{
			onClick,
			disabled,
			role: roleOverride,
			stopPropagation: stop = true,
			preventDefault: prevent = true,
			class: cls,
			children,
			...rest
		},
		ref,
	) {
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
						onClick(e);
					}
				};

		return (
			// biome-ignore lint/a11y/noStaticElementInteractions: div with role="button" and keyboard handlers
			<div
				{...rest}
				ref={ref}
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
	},
);
