import { useCallback, useMemo, useState } from "preact/hooks";
import { State } from "ts-fsrs";

import { ActionButton } from "@true-recall/obsidian/components";
import { RetentionBands } from "@true-recall/obsidian/features/library/ui/panel/components/RetentionBands";
import { usePanelStore } from "@true-recall/obsidian/features/library/ui/panel/hooks/usePanelStore";
import { useRModeSummary } from "@true-recall/obsidian/features/library/ui/panel/hooks/useRModeSummary";
import { countByState } from "@true-recall/obsidian/features/library/ui/panel/utils/card-status.utils";
import { usePlugin } from "@true-recall/obsidian/preact";

const QUICK_SIZES = [10, 20, 50] as const;

function retentionTone(averageR: number, comfortFloor: number): string {
	if (averageR >= comfortFloor) return "ep:text-obs-green";
	if (averageR >= comfortFloor - 0.15) return "ep:text-obs-orange";
	return "ep:text-obs-red";
}

/**
 * R-Mode panel for the note currently open.
 *
 * Shows what the user has rather than what they owe: no due count, no overdue
 * wording, and a session size the user types instead of one the scheduler
 * hands down.
 */
export function RModePanel() {
	const plugin = usePlugin();
	const { currentFile, cardsWithFsrs } = usePanelStore();
	const { summary, bands } = useRModeSummary();
	const sessionPersistence = plugin.sessionPersistence;
	const dayStartHour = plugin.settings.dayStartHour;

	const [size, setSize] = useState(
		String(plugin.settings.rMode.defaultSessionSize),
	);

	const counts = useMemo(() => {
		if (cardsWithFsrs.length === 0) return null;
		const stateCounts = countByState(
			cardsWithFsrs,
			sessionPersistence?.getReviewedToday(),
			dayStartHour,
		);
		const now = new Date();
		stateCounts.learning = cardsWithFsrs.filter((card) => {
			const isLearning =
				card.fsrs.state === State.Learning ||
				card.fsrs.state === State.Relearning;
			return (
				isLearning &&
				!card.fsrs.suspended &&
				(!card.fsrs.buriedUntil || new Date(card.fsrs.buriedUntil) <= now) &&
				new Date(card.fsrs.due) <= now
			);
		}).length;
		return stateCounts;
	}, [cardsWithFsrs, sessionPersistence, dayStartHour]);

	const parsedSize = Number.parseInt(size, 10);
	const requestedSize = Number.isFinite(parsedSize)
		? Math.max(0, parsedSize)
		: 0;
	const hasSupplemental = Boolean(counts?.new || counts?.learning);
	const canStart = (requestedSize > 0 && summary.pool > 0) || hasSupplemental;

	const handleStudy = useCallback(() => {
		if (!currentFile || !canStart) return;
		void plugin.reviewNoteFlashcards(currentFile, requestedSize);
	}, [currentFile, plugin, requestedSize, canStart]);

	if (summary.total === 0 && !counts?.new && !counts?.learning) return null;

	const hasPool = summary.pool > 0;

	return (
		<div class="ep:flex ep:flex-col ep:gap-2.5 ep:rounded-lg ep:border ep:border-solid ep:border-obs-border ep:bg-obs-secondary ep:px-3 ep:py-2.5">
			{summary.averageR !== null && (
				<div class="ep:flex ep:items-baseline ep:justify-between">
					<div
						class={`ep:text-2xl ep:font-semibold ep:leading-none ${retentionTone(summary.averageR, bands.comfortFloor)}`}
					>
						{Math.round(summary.averageR * 100)}%
					</div>
					<div class="ep:text-ui-smaller ep:uppercase ep:tracking-wide ep:text-obs-faint">
						retention
					</div>
				</div>
			)}

			<RetentionBands summary={summary} />

			{hasPool || hasSupplemental ? (
				<>
					{hasPool && (
						<div class="ep:text-ui-smaller ep:text-obs-muted">
							{summary.pool} review cards available
						</div>
					)}

					<div class="ep:flex ep:items-center ep:gap-2">
						<input
							type="number"
							min={0}
							step={1}
							inputMode="numeric"
							autoComplete="off"
							name="review-card-count"
							value={size}
							aria-label="Review cards this session"
							title={
								requestedSize > summary.pool
									? `${summary.pool} review cards are currently available.`
									: "Review cards this session"
							}
							class="ep:w-16 ep:shrink-0 ep:rounded-md ep:border ep:border-solid ep:border-obs-border ep:bg-obs-primary ep:px-2 ep:py-1 ep:text-center ep:text-ui-small ep:text-obs-normal"
							onInput={(event) =>
								setSize((event.target as HTMLInputElement).value)
							}
							onKeyDown={(event) => {
								if (event.key === "Enter") handleStudy();
							}}
						/>
						<ActionButton
							label="Study"
							icon="play"
							variant="primary"
							size="sm"
							fullWidth
							disabled={!canStart}
							onClick={handleStudy}
						/>
					</div>

					{hasPool && (
						<div class="ep:flex ep:items-center ep:gap-2 ep:text-ui-smaller ep:text-obs-faint">
							{QUICK_SIZES.map((quick) => (
								<button
									key={quick}
									type="button"
									class="ep:cursor-pointer ep:border-none ep:bg-transparent ep:p-0 ep:text-obs-faint ep:hover:text-obs-accent"
									onClick={() => setSize(String(quick))}
								>
									{quick}
								</button>
							))}
							<button
								type="button"
								class="ep:cursor-pointer ep:border-none ep:bg-transparent ep:p-0 ep:text-obs-faint ep:hover:text-obs-accent"
								onClick={() => setSize(String(summary.pool))}
							>
								all {summary.pool}
							</button>
						</div>
					)}
				</>
			) : (
				<div class="ep:text-ui-smaller ep:text-obs-muted">
					Nothing to review — everything here is still fresh.
				</div>
			)}

			{counts && (counts.new > 0 || counts.learning > 0) && (
				<div class="ep:flex ep:items-center ep:gap-2 ep:text-ui-smaller ep:text-obs-faint">
					{counts.new > 0 && <span>{counts.new} new</span>}
					{counts.learning > 0 && <span>{counts.learning} learning</span>}
				</div>
			)}
		</div>
	);
}
