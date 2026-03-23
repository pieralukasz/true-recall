import { Clickable } from "@shared/ui/components/Clickable";
import { useIcon } from "@shared/ui/preact/hooks";
import { cn } from "@shared/ui/utils/cn";

export interface IconToolButtonProps {
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
