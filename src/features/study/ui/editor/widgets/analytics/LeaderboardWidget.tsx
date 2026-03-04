import { useComputed } from "@preact/signals";
import { StatsCalculatorService } from "@features/metrics/services/stats/stats-calculator.service";
import { allCardsArray, cards } from "@shared/services/reactive-card-store";
import type { NotePerformanceRow } from "@shared/types/fsrs/stats.types";
import { Clickable } from "@shared/ui/components";
import { usePlugin } from "@shared/ui/preact";
import { useMemo } from "preact/hooks";
import { configValue, parseCodeblockConfig } from "../config-parser";
import { WidgetCta } from "../WidgetCta";

interface LeaderboardEntry extends NotePerformanceRow {
	resolvedName: string;
}

export function LeaderboardWidget({ source }: { source: string }) {
	const plugin = usePlugin();

	const config = useMemo(() => parseCodeblockConfig(source), [source]);

	const data = useComputed((): LeaderboardEntry[] | null => {
		cards.value;
		if (!plugin.sessionPersistence) return null;

		const statsCalc = new StatsCalculatorService(
			plugin.fsrsService,
			plugin.flashcardManager,
			plugin.sessionPersistence,
		);

		const noteRows = statsCalc.getNotePerformance();
		if (noteRows.length === 0) return null;

		const limit = configValue(config, "limit", 5) as number;
		const sortBy = configValue(config, "sort", "retention") as string;
		const order = configValue(config, "order", "asc") as string;

		// Resolve note names from sourceUid
		const allCards = allCardsArray.value;
		const uidToName = new Map<string, string>();
		for (const card of allCards) {
			if (card.fsrs.sourceUid && card.sourceNoteName) {
				uidToName.set(card.fsrs.sourceUid, card.sourceNoteName);
			}
		}

		const entries: LeaderboardEntry[] = noteRows
			.filter((row) => row.cardCount > 0)
			.map((row) => ({
				...row,
				resolvedName: uidToName.get(row.sourceUid) ?? row.sourceUid,
			}));

		// Sort
		entries.sort((a, b) => {
			let cmp = 0;
			switch (sortBy) {
				case "lapses":
					cmp = (b.avgLapses ?? 0) - (a.avgLapses ?? 0);
					break;
				case "lastReviewed":
					cmp = (a.lastReviewed ?? "").localeCompare(b.lastReviewed ?? "");
					break;
				case "cards":
					cmp = b.cardCount - a.cardCount;
					break;
				default: // retention (lowest first = worst performing)
					cmp = (a.retentionRate ?? 0) - (b.retentionRate ?? 0);
					break;
			}
			return order === "desc" ? -cmp : cmp;
		});

		return entries.slice(0, limit);
	}).value;

	if (!data || data.length === 0) {
		return (
			<div class="ep:text-obs-muted ep:text-xs ep:p-3">
				No notes with flashcards yet.
			</div>
		);
	}

	const warnBelow = configValue(config, "warnBelow", 75) as number;
	const dangerBelow = configValue(config, "dangerBelow", 65) as number;

	const handleNoteClick = (name: string) => {
		plugin
			.openReviewViewWithFilters({
				sourceNoteFilter: name,
				ignoreDailyLimits: true,
			})
			.catch(() => {});
	};

	const handleReviewWeakest = () => {
		if (data.length > 0) {
			handleNoteClick(data[0]!.resolvedName);
		}
	};

	return (
		<div class="ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:text-sm">
			{/* Header */}
			<div class="ep:flex ep:items-center ep:justify-between ep:text-xs">
				<span class="ep:font-semibold">Note Leaderboard</span>
				<span class="ep:text-obs-muted">
					sort: {configValue(config, "sort", "retention")}
				</span>
			</div>

			{/* Table header */}
			<div class="ep:flex ep:items-center ep:text-xs ep:text-obs-muted ep:gap-2">
				<span class="ep:w-4 ep:text-right">#</span>
				<span class="ep:flex-1">Note</span>
				<span class="ep:w-10 ep:text-right">Cards</span>
				<span class="ep:w-16 ep:text-right">Retention</span>
				<span class="ep:w-10 ep:text-right">Lapses</span>
			</div>

			{/* Rows */}
			{data.map((entry, idx) => {
				const retention =
					entry.retentionRate != null ? Math.round(entry.retentionRate) : null;
				const warningLevel =
					retention != null && retention < dangerBelow
						? "danger"
						: retention != null && retention < warnBelow
							? "warn"
							: "ok";

				return (
					<Clickable
						key={entry.sourceUid}
						class="ep:flex ep:items-center ep:text-xs ep:gap-2 hover:ep:bg-obs-modifier-hover ep:rounded ep:px-1 ep:py-0.5"
						onClick={() => handleNoteClick(entry.resolvedName)}
						title={`Review ${entry.resolvedName}`}
					>
						<span class="ep:w-4 ep:text-right ep:text-obs-muted">
							{idx + 1}
						</span>
						<span class="ep:flex-1 ep:truncate">{entry.resolvedName}</span>
						<span class="ep:w-10 ep:text-right">{entry.cardCount}</span>
						<span
							class="ep:w-16 ep:text-right ep:font-semibold"
							style={{
								color:
									warningLevel === "danger"
										? "var(--color-red)"
										: warningLevel === "warn"
											? "var(--color-orange)"
											: undefined,
							}}
						>
							{retention != null ? `${retention}%` : "—"}
							{warningLevel === "danger" && " !!"}
							{warningLevel === "warn" && " !"}
						</span>
						<span class="ep:w-10 ep:text-right ep:text-obs-muted">
							{entry.avgLapses.toFixed(1)}
						</span>
					</Clickable>
				);
			})}

			{/* Action buttons */}
			<div class="ep:flex ep:items-center ep:gap-2 ep:text-xs ep:pt-1 ep:border-t ep:border-obs-modifier-border">
				<WidgetCta label="Review weakest →" onClick={handleReviewWeakest} />
			</div>
		</div>
	);
}
