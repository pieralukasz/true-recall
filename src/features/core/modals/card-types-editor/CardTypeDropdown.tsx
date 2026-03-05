import type { CardTemplate } from "@shared/types/note.types";

interface CardTypeDropdownProps {
	templates: CardTemplate[];
	selectedIndex: number;
	onChange: (index: number) => void;
}

export function CardTypeDropdown({
	templates,
	selectedIndex,
	onChange,
}: CardTypeDropdownProps) {
	return (
		<select
			class="ep:flex-1 ep:px-2 ep:py-1.5 ep:text-ui-small ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded"
			value={selectedIndex}
			onChange={(e) =>
				onChange(Number((e.target as HTMLSelectElement).value))
			}
		>
			{templates.map((t, i) => (
				<option key={t.ordinal} value={i}>
					{i + 1}: {t.name}
				</option>
			))}
		</select>
	);
}
