import { useComputed } from "@preact/signals";
import { useMemo } from "preact/hooks";

import { StatsCalculatorService } from "@true-recall/core/metrics/stats/stats-calculator.service";
import type { CardSchedulingMeta } from "@true-recall/core/types";

import { Clickable } from "@true-recall/obsidian/components";
import { Q, useQuery } from "@true-recall/obsidian/data";
import { usePlugin } from "@true-recall/obsidian/preact";

import {
	configValue,
	parseCodeblockConfig,
} from "@true-recall/plugins/dashboard-codeblock/config-parser";
import { WidgetCta } from "@true-recall/plugins/dashboard-codeblock/WidgetCta";

interface ProgressData {
	newDone: number;
	newCap: number;
	reviewDone: number;
	reviewCap: number;
	totalDone: number;
	totalCap: number;
	estimatedMinutesRemaining: number;
	allDone: boolean;
}

function ProgressRing({
	value,
	max,
	color,
	radius,
	stroke,
}: {
	value: number;
	max: number;
	color: string;
	radius: number;
	stroke: number;
}) {
	const circumference = 2 * Math.PI * radius;
	const progress = max > 0 ? Math.min(value / max, 1) : 0;
	const offset = circumference * (1 - progress);
	return (
		<circle
			r={radius}
			cx={radius + stroke + 4}
			cy={radius + stroke + 4}
			fill="none"
			stroke={color}
			stroke-width={stroke}
			stroke-dasharray={`${circumference}`}
			stroke-dashoffset={`${offset}`}
			stroke-linecap="round"
			style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
		/>
	);
}

function RingTrack({ radius, stroke }: { radius: number; stroke: number }) {
	return (
		<circle
			r={radius}
			cx={radius + stroke + 4}
			cy={radius + stroke + 4}
			fill="none"
			stroke="var(--background-modifier-hover)"
			stroke-width={stroke}
		/>
	);
}

export function ProgressWidget({ source }: { source: string }) {
	const plugin = usePlugin();
	const allMeta = useQuery<Map<string, CardSchedulingMeta>>(Q.ALL_META);

	const config = useMemo(() => parseCodeblockConfig(source), [source]);

	const data = useComputed((): ProgressData | null => {
		void allMeta.value;
		if (!plugin.sessionPersistence) return null;

		const statsCalc = new StatsCalculatorService(
			plugin.fsrsService,
			plugin.flashcardManager,
			plugin.sessionPersistence,
		);

		const todaySummary = statsCalc.getTodaySummary();
		const preset = plugin.presetService.getDefaultPreset();

		const newDone = todaySummary.newCards;
		const newCap = preset.newCardsPerDay;
		const reviewDone = todaySummary.reviewCards;
		const reviewCap = preset.reviewsPerDay;
		const totalDone = newDone + reviewDone;
		const totalCap = newCap + reviewCap;

		const minutesPerCard =
			todaySummary.studied > 0
				? todaySummary.minutes / todaySummary.studied
				: 0.5;
		const remaining =
			Math.max(0, newCap - newDone) + Math.max(0, reviewCap - reviewDone);
		const estimatedMinutesRemaining = Math.round(remaining * minutesPerCard);
		const allDone = newDone >= newCap && reviewDone >= reviewCap;

		return {
			newDone,
			newCap,
			reviewDone,
			reviewCap,
			totalDone,
			totalCap,
			estimatedMinutesRemaining,
			allDone,
		};
	}).value;

	if (!data) {
		return <div class="ep:text-obs-muted ep:text-xs ep:p-3">Loading...</div>;
	}

	const showTime = configValue(config, "showTime", true);
	const style = configValue(config, "style", "ring");

	const handleClick = () => {
		plugin.openCustomStudyModal().catch(() => {});
	};

	if (data.totalCap === 0) {
		return (
			<div class="ep:text-obs-muted ep:text-xs ep:p-3">
				No daily limits configured.
			</div>
		);
	}

	if (data.allDone) {
		return (
			<Clickable
				class="ep:flex ep:flex-col ep:items-center ep:gap-1 ep:p-3"
				onClick={handleClick}
			>
				<span class="ep:text-obs-green ep:text-sm ep:font-semibold">
					&#10003; All done for today!
				</span>
				<span class="ep:text-obs-muted ep:text-xs">
					{data.totalDone} cards reviewed
				</span>
			</Clickable>
		);
	}

	return (
		<div class="ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:text-sm">
			<Clickable
				class="ep:flex ep:flex-col ep:items-center ep:gap-2"
				onClick={handleClick}
			>
				{style === "ring" ? <RingView data={data} /> : <BarView data={data} />}
			</Clickable>

			<div class="ep:flex ep:items-center ep:justify-between ep:text-xs">
				{showTime && data.estimatedMinutesRemaining > 0 && (
					<span class="ep:text-obs-muted">
						~{data.estimatedMinutesRemaining}m remaining
					</span>
				)}
				<span class="ep:ml-auto">
					<WidgetCta label="Study →" onClick={handleClick} />
				</span>
			</div>
		</div>
	);
}

function RingView({ data }: { data: ProgressData }) {
	const outerRadius = 36;
	const innerRadius = 26;
	const stroke = 5;
	const size = (outerRadius + stroke + 4) * 2;

	return (
		<div class="ep:flex ep:flex-col ep:items-center ep:gap-1">
			<svg width={size} height={size} aria-hidden="true">
				<RingTrack radius={outerRadius} stroke={stroke} />
				<ProgressRing
					value={data.reviewDone}
					max={data.reviewCap}
					color="var(--color-blue)"
					radius={outerRadius}
					stroke={stroke}
				/>
				<RingTrack radius={innerRadius} stroke={stroke} />
				<ProgressRing
					value={data.newDone}
					max={data.newCap}
					color="var(--color-green)"
					radius={innerRadius}
					stroke={stroke}
				/>
				<text
					x={size / 2}
					y={size / 2}
					text-anchor="middle"
					dominant-baseline="central"
					fill="currentColor"
					font-size="12"
					font-weight="600"
				>
					{data.totalDone}/{data.totalCap}
				</text>
			</svg>
			<div class="ep:flex ep:items-center ep:gap-3 ep:text-xs ep:text-obs-muted">
				<span class="ep:flex ep:items-center ep:gap-1">
					<span
						class="ep:inline-block ep:w-2 ep:h-2 ep:rounded-full"
						style={{ background: "var(--color-green)" }}
					/>
					New
				</span>
				<span class="ep:flex ep:items-center ep:gap-1">
					<span
						class="ep:inline-block ep:w-2 ep:h-2 ep:rounded-full"
						style={{ background: "var(--color-blue)" }}
					/>
					Reviews
				</span>
			</div>
		</div>
	);
}

function BarView({ data }: { data: ProgressData }) {
	const newPct =
		data.newCap > 0 ? Math.min(data.newDone / data.newCap, 1) * 100 : 0;
	const reviewPct =
		data.reviewCap > 0
			? Math.min(data.reviewDone / data.reviewCap, 1) * 100
			: 0;

	return (
		<div class="ep:flex ep:flex-col ep:gap-2 ep:w-full">
			<ProgressBar
				label="New"
				value={data.newDone}
				max={data.newCap}
				pct={newPct}
				color="var(--color-green)"
			/>
			<ProgressBar
				label="Reviews"
				value={data.reviewDone}
				max={data.reviewCap}
				pct={reviewPct}
				color="var(--color-blue)"
			/>
		</div>
	);
}

function ProgressBar({
	label,
	value,
	max,
	pct,
	color,
}: {
	label: string;
	value: number;
	max: number;
	pct: number;
	color: string;
}) {
	return (
		<div class="ep:flex ep:items-center ep:gap-2 ep:text-xs">
			<span class="ep:w-14 ep:text-obs-muted">{label}</span>
			<div
				class="ep:flex-1 ep:h-2 ep:rounded-full ep:overflow-hidden"
				style={{ background: "var(--background-modifier-hover)" }}
			>
				<div
					class="ep:h-full ep:rounded-full ep:transition-all"
					style={{ width: `${pct}%`, background: color }}
				/>
			</div>
			<span class="ep:w-10 ep:text-right ep:text-obs-muted">
				{value}/{max}
			</span>
		</div>
	);
}
