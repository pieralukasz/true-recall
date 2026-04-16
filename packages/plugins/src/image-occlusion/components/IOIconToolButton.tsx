import { Clickable } from "@true-recall/obsidian/components";
import { useIcon } from "@true-recall/obsidian/preact/hooks";
import { cn } from "@true-recall/obsidian/utils/cn";

interface IconToolButtonProps {
	icon: string;
	label: string;
	shortcut?: string;
	active?: boolean;
	danger?: boolean;
	disabled?: boolean;
	onClick: () => void;
}

export function IconToolButton({
	icon,
	label,
	shortcut,
	active = false,
	danger = false,
	disabled = false,
	onClick,
}: IconToolButtonProps) {
	const iconRef = useIcon(icon);
	const tooltip = shortcut ? `${label} (${shortcut})` : label;

	return (
		<Clickable
			class={cn(
				"true-recall-io-icon-btn",
				active && "is-active",
				danger && "is-danger",
			)}
			aria-label={label}
			title={tooltip}
			onClick={() => onClick()}
			disabled={disabled}
		>
			<span ref={iconRef} />
		</Clickable>
	);
}
