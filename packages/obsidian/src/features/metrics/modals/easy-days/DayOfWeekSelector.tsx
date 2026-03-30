import { Clickable } from "@shared/ui/components";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const BASE_BTN =
	"ep:px-3 ep:py-1.5 ep:rounded-md ep:border ep:text-ui-small ep:font-medium ep:transition-colors";
const SELECTED_BTN = `${BASE_BTN} ep:bg-obs-interactive ep:text-obs-on-accent ep:border-obs-interactive`;
const UNSELECTED_BTN = `${BASE_BTN} ep:bg-transparent ep:border-obs-border ep:text-obs-normal ep:hover:bg-obs-modifier-hover`;

function DayButton({
	name,
	isSelected,
	onToggle,
}: {
	name: string;
	isSelected: boolean;
	onToggle: () => void;
}) {
	return (
		<Clickable
			class={isSelected ? SELECTED_BTN : UNSELECTED_BTN}
			onClick={onToggle}
		>
			{name}
		</Clickable>
	);
}

export interface DayOfWeekSelectorProps {
	selectedDays: Set<number>;
	onToggleDay: (index: number) => void;
}

export function DayOfWeekSelector({
	selectedDays,
	onToggleDay,
}: DayOfWeekSelectorProps) {
	return (
		<div class="ep:mb-5">
			<h4 class="ep:text-ui-small ep:font-semibold ep:mb-2 ep:text-obs-normal">
				Recurring days
			</h4>
			<p class="ep:text-ui-smaller ep:text-obs-muted ep:mb-3">
				Select days of the week with reduced workload
			</p>
			<div class="ep:flex ep:gap-1.5 ep:flex-wrap">
				{DAY_NAMES.map((name, index) => (
					<DayButton
						key={index}
						name={name}
						isSelected={selectedDays.has(index)}
						onToggle={() => onToggleDay(index)}
					/>
				))}
			</div>
		</div>
	);
}
