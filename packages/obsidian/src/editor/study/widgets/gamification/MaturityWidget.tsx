import { useComputed } from "@preact/signals";
import { StatsCalculatorService } from "@true-recall/core/metrics/stats/stats-calculator.service";
import type { CardSchedulingMeta } from "@true-recall/core/types";
import type { CardMaturityBreakdown } from "@true-recall/core/types/fsrs/stats.types";
import { Q, useQuery } from "@true-recall/obsidian/data";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useMemo } from "preact/hooks";
import { configValue, parseCodeblockConfig } from "../config-parser";

interface MaturitySegment {
	label: string;
	count: number;
	pct: number;
	color: string;
	opacity?: number;
}

function buildSegments(
	breakdown: CardMaturityBreakdown,
	showSuspended: boolean,
): MaturitySegment[] {
	const entries: {
		label: string;
		count: number;
		color: string;
		opacity?: number;
	}[] = [
		{ label: "New", count: breakdown.new, color: "var(--color-green)" },
		{
			label: "Learning",
			count: breakdown.learning,
			color: "var(--color-orange)",
		},
		{
			label: "Young",
			count: breakdown.young,
			color: "var(--color-blue)",
			opacity: 0.6,
		},
		{ label: "Mature", count: breakdown.mature, color: "var(--color-blue)" },
	];

	if (showSuspended) {
		entries.push(
			{
				label: "Suspended",
				count: breakdown.suspended,
				color: "var(--color-red)",
			},
			{ label: "Buried", count: breakdown.buried, color: "var(--text-muted)" },
		);
	}

	const total = entries.reduce((sum, e) => sum + e.count, 0);
	if (total === 0) return [];

	return entries
		.filter((e) => e.count > 0)
		.map((e) => ({
			...e,
			pct: (e.count / total) * 100,
		}));
}

export function MaturityWidget({ source }: { source: string }) {
	const plugin = usePlugin();
	const allMeta = useQuery<Map<string, CardSchedulingMeta>>(Q.ALL_META);

	const config = useMemo(() => parseCodeblockConfig(source), [source]);
	const showSuspended = configValue(config, "showSuspended", false) as boolean;

	const data = useComputed(
		(): { segments: MaturitySegment[]; total: number } | null => {
			void allMeta.value;
			if (!plugin.sessionPersistence) return null;

			const statsCalc = new StatsCalculatorService(
				plugin.fsrsService,
				plugin.flashcardManager,
				plugin.sessionPersistence,
			);

			const breakdown = statsCalc.getCardMaturityBreakdown();
			const segments = buildSegments(breakdown, showSuspended);
			const total = segments.reduce((sum, s) => sum + s.count, 0);

			return { segments, total };
		},
	).value;

	if (!data || data.total === 0) {
		return <div class="ep:text-obs-muted ep:text-xs ep:p-3">No cards yet</div>;
	}

	return (
		<div class="ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:text-sm">
			<div class="ep:flex ep:items-center ep:justify-between ep:text-xs">
				<span class="ep:font-semibold">Card Maturity</span>
				<span class="ep:text-obs-muted">{data.total} cards</span>
			</div>

			<div class="ep:flex ep:h-5 ep:rounded ep:overflow-hidden">
				{data.segments.map((seg) => (
					<div
						key={seg.label}
						style={{
							width: `${seg.pct}%`,
							backgroundColor: seg.color,
							opacity: seg.opacity,
							minWidth: seg.count > 0 ? "2px" : "0",
						}}
						title={`${seg.label}: ${seg.count} (${Math.round(seg.pct)}%)`}
					/>
				))}
			</div>

			<div class="ep:flex ep:flex-wrap ep:gap-x-3 ep:gap-y-1 ep:text-xs">
				{data.segments.map((seg) => (
					<div key={seg.label} class="ep:inline-flex ep:items-center ep:gap-1">
						<span
							class="ep:w-2 ep:h-2 ep:rounded-full ep:inline-block ep:shrink-0"
							style={{
								backgroundColor: seg.color,
								opacity: seg.opacity,
							}}
						/>
						<span class="ep:text-obs-muted">
							{seg.label} {seg.count}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}
