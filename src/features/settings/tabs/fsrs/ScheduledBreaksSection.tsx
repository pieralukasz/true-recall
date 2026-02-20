import { useCallback } from "preact/hooks";
import type { TrueRecallSettings } from "@shared/types";
import { ActionButton, InfoBlock, SettingRow } from "@shared/ui/components";

interface ScheduledBreaksSectionProps {
	settings: TrueRecallSettings;
	save: (patch: Partial<TrueRecallSettings>) => Promise<void>;
	onRefresh: () => void;
}

export function ScheduledBreaksSection({
	settings,
	save,
	onRefresh,
}: ScheduledBreaksSectionProps) {
	const breaks = settings.scheduledBreaks;

	const handleDeleteBreak = useCallback(
		async (index: number) => {
			await save({
				scheduledBreaks: breaks.filter((_, i) => i !== index),
			});
			onRefresh();
		},
		[breaks, save, onRefresh],
	);

	const handleAddBreak = useCallback(async () => {
		// eslint-disable-next-line no-alert
		const startDate = prompt("Start date (YYYY-MM-DD):");
		// eslint-disable-next-line no-alert
		const endDate = prompt("End date (YYYY-MM-DD):");
		if (startDate && endDate) {
			await save({
				scheduledBreaks: [
					...breaks,
					{
						id: crypto.randomUUID(),
						startDate,
						endDate,
						redistributeBefore: true,
						redistributeAfter: true,
					},
				],
			});
			onRefresh();
		}
	}, [breaks, save, onRefresh]);

	return (
		<>
			<SettingRow heading name="Scheduled breaks" />

			<InfoBlock>
				<p>
					Schedule breaks (vacations) to redistribute reviews and prevent
					backlog accumulation.
				</p>
			</InfoBlock>

			{breaks.length > 0 && (
				<div class="ep:space-y-2 ep:mb-4">
					{breaks.map((brk, index) => (
						<div
							key={brk.id}
							class="ep:flex ep:items-center ep:justify-between ep:p-2 ep:bg-obs-background-modifier-form ep:rounded-lg"
						>
							<span>
								{brk.startDate} to {brk.endDate}
							</span>
							<button
								type="button"
								class="ep:text-ui-small"
								onClick={() => handleDeleteBreak(index)}
							>
								Delete
							</button>
						</div>
					))}
				</div>
			)}

			<SettingRow
				name="Add scheduled break"
				description="Schedule a break period"
			>
				<ActionButton
					label="Add break..."
					variant="secondary"
					onClick={handleAddBreak}
				/>
			</SettingRow>
		</>
	);
}
