const ICON_MAP: Record<string, string> = {
	"trash-2": "\u{1F5D1}\u{FE0F}",
	folder: "\u{1F4C1}",
	"file-plus": "\u{1F4DD}",
};

export interface OrphanedActionButtonProps {
	icon: string;
	label: string;
	description: string;
	type: "primary" | "secondary" | "danger";
	onClick: () => void;
}

export function OrphanedActionButton({
	icon,
	label,
	description,
	type,
	onClick,
}: OrphanedActionButtonProps) {
	const btnCls =
		type === "danger"
			? "ep:bg-obs-red ep:text-obs-on-accent ep:hover:opacity-90"
			: "ep:bg-obs-secondary ep:text-obs-normal ep:hover:bg-obs-modifier-hover";

	return (
		<button
			type="button"
			class={`ep:w-full ep:py-3 ep:px-4 ep:rounded-md ep:border ep:border-obs-border ep:cursor-pointer ep:transition-colors ep:text-left ${btnCls}`}
			onClick={onClick}
		>
			<div class="ep:flex ep:items-center ep:gap-3">
				<span class="ep:text-lg">{ICON_MAP[icon] ?? "\u{2022}"}</span>
				<div>
					<div class="ep:font-medium ep:text-ui-small">{label}</div>
					<div class="ep:text-ui-smaller ep:opacity-70">{description}</div>
				</div>
			</div>
		</button>
	);
}
