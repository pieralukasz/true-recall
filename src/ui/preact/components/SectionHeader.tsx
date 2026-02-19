import { Platform } from "obsidian";
import { useIcon } from "../hooks";

export interface SectionHeaderAction {
	icon: string;
	ariaLabel: string;
	onClick: () => void;
}

export interface SectionHeaderProps {
	title: string;
	actions?: SectionHeaderAction[];
	hideOnMobile?: boolean;
	class?: string;
}

function ActionIcon({ icon, ariaLabel, onClick }: SectionHeaderAction) {
	const iconRef = useIcon(icon);
	return (
		<button class="clickable-icon" aria-label={ariaLabel} onClick={onClick}>
			<span ref={iconRef} />
		</button>
	);
}

export function SectionHeader({ title, actions, hideOnMobile = false, class: cls }: SectionHeaderProps) {
	if (hideOnMobile && Platform.isMobile) {
		return <div />;
	}

	return (
		<div class={`ep:flex ep:items-center ep:justify-between ${cls ?? ""}`}>
			<div class="ep:text-ui-small ep:font-semibold ep:text-obs-normal">{title}</div>
			{actions && actions.length > 0 && (
				<div class="ep:flex ep:items-center ep:gap-1">
					{actions.map((action, i) => (
						<ActionIcon key={i} {...action} />
					))}
				</div>
			)}
		</div>
	);
}
