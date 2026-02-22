import { effect } from "@preact/signals";
import { dataVersion, track } from "@shared/services/signals";
import { FSRS_COLORS } from "@shared/ui/helpers/fsrs-colors";
import { usePlugin } from "@shared/ui/preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import { configValue, parseCodeblockConfig } from "./config-parser";

interface NoteHealthData {
	totalCards: number;
	avgRetention: number;
	avgStability: number;
	atRiskCount: number;
	dueCount: number;
	sourceNoteName: string | null;
}

export function NoteHealthWidget({ sourceUid, source }: { sourceUid: string | null; source: string }) {
	const plugin = usePlugin();
	const [ver, setVer] = useState(0);

	useEffect(() => {
		const dispose = effect(() => {
			track(dataVersion);
			setVer((v) => v + 1);
		});
		return dispose;
	}, []);

	const config = useMemo(() => parseCodeblockConfig(source), [source]);

	const data = useMemo((): NoteHealthData | null => {
		void ver;
		if (!sourceUid || !plugin.cardStore) return null;

		const cards = plugin.cardStore.getCardsBySourceUid(sourceUid);
		if (cards.length === 0) return null;

		const now = new Date();
		let totalRetention = 0;
		let totalStability = 0;
		let activeCount = 0;
		let atRiskCount = 0;
		let dueCount = 0;

		// Resolve note name from any card
		const allFsrs = plugin.flashcardManager.getAllFSRSCards();
		const noteCard = allFsrs.find((c) => c.fsrs.sourceUid === sourceUid);
		const sourceNoteName = noteCard?.sourceNoteName ?? null;

		for (const card of cards) {
			if (card.suspended) continue;
			if (card.buriedUntil && new Date(card.buriedUntil) > now) continue;

			// Due check
			if (card.state === 2 && new Date(card.due) <= now) dueCount++;
			if (card.state === 1 || card.state === 3) dueCount++; // learning/relearning always "due"

			// Retrievability (skip new cards)
			if (card.state !== 0) {
				const r = plugin.fsrsService.getRetrievability(card, now);
				totalRetention += r;
				totalStability += card.stability;
				activeCount++;
				if (r < 0.5) atRiskCount++;
			}
		}

		const avgRetention = activeCount > 0 ? totalRetention / activeCount : 0;
		const avgStability = activeCount > 0 ? totalStability / activeCount : 0;

		return {
			totalCards: cards.length,
			avgRetention,
			avgStability,
			atRiskCount,
			dueCount,
			sourceNoteName,
		};
	}, [plugin, sourceUid, ver]);

	if (!data) {
		return <div class="ep:text-obs-muted ep:text-xs ep:p-3">No flashcards found in this note.</div>;
	}

	const showActions = configValue(config, "showActions", true);
	const showDetails = configValue(config, "showDetails", true);
	const retentionPct = Math.round(data.avgRetention * 100);

	const barColor =
		retentionPct >= 90
			? "var(--color-green)"
			: retentionPct >= 75
				? "var(--color-cyan)"
				: retentionPct >= 60
					? "var(--color-orange)"
					: "var(--color-red)";

	const handleReviewDue = () => {
		if (!data.sourceNoteName) return;
		plugin.openReviewViewWithFilters({
			sourceNoteFilter: data.sourceNoteName,
			ignoreDailyLimits: true,
		}).catch(() => {});
	};

	const handleFixWeak = () => {
		if (!data.sourceNoteName) return;
		plugin.openReviewViewWithFilters({
			sourceNoteFilter: data.sourceNoteName,
			weakCardsOnly: true,
			ignoreDailyLimits: true,
		}).catch(() => {});
	};

	return (
		<div class="ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:text-sm">
			{/* Health bar row */}
			<div class="ep:flex ep:items-center ep:gap-3">
				<span class="ep:text-xs ep:font-semibold ep:whitespace-nowrap">
					Health: {retentionPct}%
				</span>
				<div class="ep:flex-1 ep:h-2.5 ep:rounded-full ep:bg-obs-modifier-hover ep:overflow-hidden">
					<div
						class="ep:h-full ep:rounded-full ep:transition-all"
						style={{
							width: `${retentionPct}%`,
							backgroundColor: barColor,
						}}
					/>
				</div>
			</div>

			{/* Details row */}
			{showDetails && (
				<div class="ep:flex ep:items-center ep:gap-2 ep:text-xs ep:text-obs-muted ep:flex-wrap">
					<span>{data.totalCards} cards</span>
					<span style={{ opacity: 0.4 }}>│</span>
					<span>avg stab: {formatStability(data.avgStability)}</span>
					<span style={{ opacity: 0.4 }}>│</span>
					{data.atRiskCount > 0 ? (
						<span style={{ color: `var(${FSRS_COLORS.suspended.cssVar})` }}>
							{data.atRiskCount} at risk
						</span>
					) : (
						<span class="ep:text-obs-green">0 at risk</span>
					)}
					<span style={{ opacity: 0.4 }}>│</span>
					<span style={{ color: `var(${FSRS_COLORS.review.cssVar})` }}>
						{data.dueCount} due
					</span>
				</div>
			)}

			{/* Action buttons */}
			{showActions && (data.dueCount > 0 || data.atRiskCount > 0) && (
				<div class="ep:flex ep:items-center ep:gap-2 ep:text-xs">
					{data.dueCount > 0 && (
						<button
							class="ep:px-2 ep:py-0.5 ep:rounded ep:bg-obs-interactive-accent ep:text-obs-on-accent ep:cursor-pointer hover:ep:opacity-90"
							onClick={handleReviewDue}
						>
							Review {data.dueCount} due →
						</button>
					)}
					{data.atRiskCount > 0 && (
						<button
							class="ep:px-2 ep:py-0.5 ep:rounded ep:border ep:border-obs-modifier-border ep:cursor-pointer hover:ep:bg-obs-modifier-hover"
							onClick={handleFixWeak}
						>
							Fix {data.atRiskCount} weak →
						</button>
					)}
				</div>
			)}
		</div>
	);
}

function formatStability(days: number): string {
	if (days < 1) return `${Math.round(days * 24)}h`;
	if (days < 30) return `${Math.round(days)}d`;
	if (days < 365) return `${Math.round(days / 30)}mo`;
	return `${(days / 365).toFixed(1)}y`;
}
