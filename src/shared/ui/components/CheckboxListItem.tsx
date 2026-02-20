import { useCallback, useState } from "preact/hooks";

export interface CheckboxListItemProps {
	label: string;
	itemKey: string;
	selectedSet: Set<string>;
	onToggle: (key: string, checked: boolean) => void;
}

export function CheckboxListItem({
	label,
	itemKey,
	selectedSet,
	onToggle,
}: CheckboxListItemProps) {
	const [checked, setChecked] = useState(selectedSet.has(itemKey));

	const toggle = useCallback(() => {
		const next = !checked;
		setChecked(next);
		onToggle(itemKey, next);
	}, [checked, itemKey, onToggle]);

	return (
		<div
			class="ep:flex ep:items-center ep:gap-2 ep:p-2 ep:border-b ep:border-obs-border ep:last:border-b-0 ep:cursor-pointer ep:hover:bg-obs-modifier-hover"
			role="option"
			tabIndex={0}
			aria-selected={checked}
			onClick={toggle}
			onKeyDown={(e: KeyboardEvent) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					toggle();
				}
			}}
		>
			<input
				type="checkbox"
				class="ep:w-4 ep:h-4 ep:accent-obs-interactive"
				checked={checked}
				onClick={(e) => e.stopPropagation()}
				onChange={toggle}
			/>
			<span class="ep:text-ui-small">{label}</span>
		</div>
	);
}
