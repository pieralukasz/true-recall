import { useComputed } from "@preact/signals";
import { usePlugin } from "@true-recall/obsidian/preact";
import {
	allCardsArray,
	cards,
	cardsBySourceUid,
} from "@true-recall/obsidian/services/reactive-card-store";
import { useMemo } from "preact/hooks";
import { State } from "ts-fsrs";
import { configValue, parseCodeblockConfig } from "../config-parser";
import { WidgetCta } from "../WidgetCta";

interface DecayCard {
	id: string;
	question: string;
	retrievability: number;
	stability: number;
	sourceNoteName: string | null;
}

interface DecayData {
	cards: DecayCard[];
	totalCards: number;
	avgRetention: number;
	atRiskCount: number;
	targetRetention: number;
	sourceNoteName: string | null;
}

export function DecayWidget({
	sourceUid,
	source,
}: {
	sourceUid: string | null;
	source: string;
}) {
	const plugin = usePlugin();

	const config = useMemo(() => parseCodeblockConfig(source), [source]);

	const data = useComputed((): DecayData | null => {
		void cards.value;
		if (!sourceUid) return null;

		const noteCards = cardsBySourceUid.value.get(sourceUid) ?? [];
		if (noteCards.length === 0) return null;

		const now = new Date();
		const targetRetention = configValue(config, "target", 0.9) as number;
		const limit = configValue(config, "limit", 10) as number;
		const sortBy = configValue(config, "sort", "retrievability") as string;

		// Resolve note name
		const allFsrs = allCardsArray.value;
		const noteCard = allFsrs.find((c) => c.fsrs.sourceUid === sourceUid);
		const sourceNoteName = noteCard?.sourceNoteName ?? null;

		const decayCards: DecayCard[] = [];
		let totalRetention = 0;
		let activeCount = 0;
		let atRiskCount = 0;

		for (const card of noteCards) {
			const fsrs = card.fsrs;
			if (fsrs.suspended) continue;
			if (fsrs.state === State.New) continue; // skip new cards — no retrievability

			const r = plugin.fsrsService.getRetrievability(fsrs, now);
			totalRetention += r;
			activeCount++;
			if (r < 0.5) atRiskCount++;

			decayCards.push({
				id: card.id,
				question: truncateQuestion(
					"question" in card
						? ((card as { question?: string }).question ?? "Card")
						: "Card",
				),
				retrievability: r,
				stability: fsrs.stability,
				sourceNoteName,
			});
		}

		// Sort
		decayCards.sort((a, b) => {
			switch (sortBy) {
				case "stability":
					return a.stability - b.stability;
				case "due":
					return a.retrievability - b.retrievability;
				default: // retrievability (lowest first)
					return a.retrievability - b.retrievability;
			}
		});

		return {
			cards: decayCards.slice(0, limit),
			totalCards: noteCards.length,
			avgRetention: activeCount > 0 ? totalRetention / activeCount : 0,
			atRiskCount,
			targetRetention,
			sourceNoteName,
		};
	}).value;

	if (!data) {
		return (
			<div class="ep:text-obs-muted ep:text-xs ep:p-3">
				No flashcards found in this note.
			</div>
		);
	}

	const showTarget = configValue(config, "showTarget", true);
	const showStability = configValue(config, "showStability", true);
	const remainingCount = data.totalCards - data.cards.length;
	const targetPct = Math.round(data.targetRetention * 100);

	const handleReviewAtRisk = () => {
		if (!data.sourceNoteName) return;
		plugin
			.openReviewViewWithFilters({
				sourceNoteFilter: data.sourceNoteName,
				weakCardsOnly: true,
				ignoreDailyLimits: true,
			})
			.catch(() => {});
	};

	return (
		<div class="ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:text-sm">
			{/* Header */}
			<div class="ep:flex ep:items-center ep:justify-between ep:text-xs">
				<span class="ep:font-semibold">Memory Decay</span>
				<div class="ep:flex ep:items-center ep:gap-2">
					<span class="ep:text-obs-muted">{data.totalCards} cards</span>
					{showTarget && (
						<span class="ep:text-obs-muted">target: {targetPct}%</span>
					)}
				</div>
			</div>

			{/* Decay bars */}
			<div class="ep:flex ep:flex-col ep:gap-1">
				{data.cards.map((card) => {
					const pct = Math.round(card.retrievability * 100);
					const belowTarget = card.retrievability < data.targetRetention;
					const barColor = belowTarget
						? card.retrievability < 0.5
							? "var(--color-red)"
							: "var(--color-orange)"
						: "var(--color-green)";

					return (
						<div
							key={card.id}
							class="ep:flex ep:items-center ep:gap-2 ep:text-xs"
							title={card.question}
						>
							{/* Card label + stability */}
							<span class="ep:w-24 ep:truncate ep:text-obs-muted">
								{card.question}
								{showStability && (
									<span class="ep:ml-1 ep:opacity-60">
										({formatStability(card.stability)})
									</span>
								)}
							</span>

							{/* Bar */}
							<div class="ep:flex-1 ep:h-2.5 ep:rounded ep:bg-obs-modifier-hover ep:overflow-hidden ep:relative">
								{/* Filled portion */}
								<div
									class="ep:h-full ep:rounded"
									style={{
										width: `${pct}%`,
										backgroundColor: barColor,
									}}
								/>
								{/* Target marker */}
								{showTarget && (
									<div
										class="ep:absolute ep:top-0 ep:h-full ep:w-px ep:bg-obs-text-normal ep:opacity-40"
										style={{ left: `${targetPct}%` }}
									/>
								)}
							</div>

							{/* Percentage */}
							<span
								class="ep:w-8 ep:text-right ep:font-semibold"
								style={{ color: belowTarget ? barColor : undefined }}
							>
								{pct}%
							</span>
						</div>
					);
				})}
			</div>

			{/* Summary + actions */}
			<div class="ep:flex ep:items-center ep:justify-between ep:text-xs ep:pt-1 ep:border-t ep:border-obs-modifier-border">
				{remainingCount > 0 && (
					<span class="ep:text-obs-muted">
						... {remainingCount} more (avg:{" "}
						{Math.round(data.avgRetention * 100)}%)
					</span>
				)}
				{remainingCount === 0 && (
					<span class="ep:text-obs-muted">
						avg: {Math.round(data.avgRetention * 100)}%
					</span>
				)}

				{data.atRiskCount > 0 && (
					<WidgetCta
						label={`Review at-risk (${data.atRiskCount}) →`}
						onClick={handleReviewAtRisk}
					/>
				)}
			</div>
		</div>
	);
}

function truncateQuestion(q: string): string {
	const clean = q.replace(/[#*_`~[\]]/g, "").trim();
	if (clean.length <= 30) return clean;
	return `${clean.slice(0, 27)}...`;
}

function formatStability(days: number): string {
	if (days < 1) return `${Math.round(days * 24)}h`;
	if (days < 30) return `${Math.round(days)}d`;
	if (days < 365) return `${Math.round(days / 30)}mo`;
	return `${(days / 365).toFixed(1)}y`;
}
