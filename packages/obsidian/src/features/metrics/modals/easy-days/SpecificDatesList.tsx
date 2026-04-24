import { Clickable } from "@true-recall/obsidian/components";

function formatDate(dateStr: string): string {
	const date = new Date(`${dateStr}T00:00:00`);
	return date.toLocaleDateString(undefined, {
		weekday: "short",
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

interface SpecificDatesListProps {
	dates: Set<string>;
	dateInputValue: string;
	today: string;
	onDateInputChange: (value: string) => void;
	onAddDate: () => void;
	onRemoveDate: (dateStr: string) => void;
}

export function SpecificDatesList({
	dates,
	dateInputValue,
	today,
	onDateInputChange,
	onAddDate,
	onRemoveDate,
}: SpecificDatesListProps) {
	const sortedDates = Array.from(dates).sort();

	return (
		<div class="ep:mb-5">
			<h4 class="ep:text-ui-small ep:font-semibold ep:mb-2 ep:text-obs-normal">
				Specific dates
			</h4>
			<p class="ep:text-ui-smaller ep:text-obs-muted ep:mb-3">
				Add individual dates with reduced workload
			</p>

			<div class="ep:flex ep:gap-2 ep:mb-3">
				<input
					type="date"
					class="ep:flex-1 ep:py-2 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small"
					min={today}
					value={dateInputValue}
					onChange={(e) =>
						onDateInputChange((e.target as HTMLInputElement).value)
					}
				/>
				<Clickable
					class="ep:px-4 ep:py-2 ep:rounded-md ep:bg-obs-interactive ep:text-obs-on-accent ep:border-none ep:text-ui-small ep:font-medium ep:hover:opacity-90"
					onClick={onAddDate}
				>
					+ add
				</Clickable>
			</div>

			<div class="ep:border ep:border-obs-border ep:rounded-md ep:max-h-[150px] ep:overflow-y-auto">
				{sortedDates.length === 0 ? (
					<div class="ep:py-4 ep:px-3 ep:text-center ep:text-obs-muted ep:text-ui-smaller ep:italic">
						No specific dates added
					</div>
				) : (
					sortedDates.map((dateStr) => (
						<div
							key={dateStr}
							class="ep:flex ep:items-center ep:justify-between ep:py-2 ep:px-3 ep:border-b ep:border-obs-border ep:last:border-b-0"
						>
							<span class="ep:text-ui-small ep:text-obs-normal">
								{formatDate(dateStr)}
							</span>
							<Clickable
								class="ep:w-6 ep:h-6 ep:rounded-md ep:bg-transparent ep:border-none ep:text-obs-muted ep:text-lg ep:hover:text-obs-red ep:hover:bg-obs-red/10"
								onClick={() => onRemoveDate(dateStr)}
							>
								&times;
							</Clickable>
						</div>
					))
				)}
			</div>
		</div>
	);
}
