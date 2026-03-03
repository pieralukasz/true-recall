import { useComputed } from "@preact/signals";
import { cards } from "@shared/services/reactive-card-store";
import type { ProblemCard } from "@shared/types/nl-query.types";
import { Clickable } from "@shared/ui/components";
import { usePlugin } from "@shared/ui/preact";
import { useMemo } from "preact/hooks";
import { configValue, parseCodeblockConfig } from "../config-parser";
import { WidgetCta } from "../WidgetCta";

const PROBLEM_BADGES: Record<
	ProblemCard["problemType"],
	{ label: string; color: string }
> = {
	high_lapses: { label: "leech", color: "var(--color-red)" },
	low_stability: { label: "unstable", color: "var(--color-orange)" },
	relearning: { label: "relearning", color: "var(--color-yellow)" },
};

function getMetricLabel(card: ProblemCard): string {
	switch (card.problemType) {
		case "high_lapses":
			return `${card.lapses} lapses`;
		case "low_stability":
			return `S: ${card.stability.toFixed(1)}`;
		case "relearning":
			return `D: ${card.difficulty.toFixed(1)}`;
	}
}

export function ProblemCardsWidget({ source }: { source: string }) {
	const plugin = usePlugin();

	const config = useMemo(() => parseCodeblockConfig(source), [source]);

	const limit = configValue(config, "limit", 5) as number;
	const showType = configValue(config, "showType", true);

	const data = useComputed(() => {
		cards.value;
		if (!plugin.cardStore?.stats) return null;
		return plugin.cardStore.stats.getProblemCards(limit);
	}).value;

	if (!data) {
		return (
			<div class="ep:text-obs-muted ep:text-xs ep:p-3">Loading...</div>
		);
	}

	if (data.length === 0) {
		return (
			<div class="ep:flex ep:items-center ep:gap-2 ep:p-3 ep:text-xs">
				<span style={{ color: "var(--color-green)" }}>&#10003;</span>
				<span class="ep:text-obs-muted">All cards healthy!</span>
			</div>
		);
	}

	const handleReview = () => {
		plugin
			.openReviewViewWithFilters({
				overdueOnly: true,
				ignoreDailyLimits: true,
			})
			.catch(() => {});
	};

	return (
		<div class="ep:flex ep:flex-col ep:gap-1.5 ep:p-3 ep:text-xs">
			{/* Header */}
			<div class="ep:flex ep:items-center ep:justify-between ep:mb-0.5">
				<span class="ep:font-semibold">Problem Cards</span>
				<span class="ep:text-obs-muted">{data.length} found</span>
			</div>

			{/* Card list */}
			{data.map((card) => {
				const badge = PROBLEM_BADGES[card.problemType];
				return (
					<Clickable
						key={card.id}
						class="ep:flex ep:items-center ep:gap-2 ep:rounded ep:px-1.5 ep:py-1 hover:ep:bg-obs-modifier-hover"
						onClick={handleReview}
						title={card.question}
					>
						<span class="ep:flex-1 ep:truncate ep:min-w-0">
							{truncateQuestion(card.question)}
						</span>
						{showType && (
							<span
								class="ep:shrink-0 ep:px-1.5 ep:py-0.5 ep:rounded ep:text-[10px] ep:font-medium"
								style={{
									color: badge.color,
									backgroundColor: `color-mix(in srgb, ${badge.color} 12%, transparent)`,
								}}
							>
								{badge.label}
							</span>
						)}
						<span class="ep:shrink-0 ep:text-obs-muted ep:text-[10px] ep:w-16 ep:text-right">
							{getMetricLabel(card)}
						</span>
					</Clickable>
				);
			})}

			{/* CTA */}
			<div class="ep:flex ep:justify-end ep:pt-1">
				<WidgetCta label="Review problem cards &rarr;" onClick={handleReview} />
			</div>
		</div>
	);
}

function truncateQuestion(q: string): string {
	const clean = q.replace(/\n/g, " ").trim();
	if (clean.length <= 40) return clean;
	return `${clean.slice(0, 37)}...`;
}
