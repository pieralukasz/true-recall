import { StatsCalculatorService } from "@features/metrics/services/stats/stats-calculator.service";
import { effect } from "@preact/signals";
import { dataVersion, track } from "@shared/services/signals";
import { usePlugin } from "@shared/ui/preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { configValue, parseCodeblockConfig } from "./config-parser";

interface HeatmapCell {
	date: string;
	count: number;
	level: 0 | 1 | 2 | 3 | 4;
	row: number; // 0-6 (Mon=0, Sun=6)
	col: number; // week index
}

interface HeatmapData {
	cells: HeatmapCell[];
	monthLabels: { label: string; col: number }[];
	daysActive: number;
	totalReviews: number;
	maxWeeks: number;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CELL_SIZE = 11;
const CELL_GAP = 2;
const CELL_TOTAL = CELL_SIZE + CELL_GAP;

const LEVEL_COLORS = [
	"var(--background-modifier-hover)",
	"var(--color-green)",
	"var(--color-green)",
	"var(--color-green)",
	"var(--color-green)",
];
const LEVEL_OPACITIES = [1, 0.3, 0.5, 0.7, 1];

export function HeatmapWidget({ source }: { source: string }) {
	const plugin = usePlugin();
	const [ver, setVer] = useState(0);
	const [tooltip, setTooltip] = useState<{ cell: HeatmapCell; x: number; y: number } | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const dispose = effect(() => {
			track(dataVersion);
			setVer((v) => v + 1);
		});
		return dispose;
	}, []);

	const config = useMemo(() => parseCodeblockConfig(source), [source]);

	const data = useMemo((): HeatmapData | null => {
		void ver;
		if (!plugin.sessionPersistence) return null;

		const statsCalc = new StatsCalculatorService(
			plugin.fsrsService,
			plugin.flashcardManager,
			plugin.sessionPersistence,
		);

		const months = configValue(config, "months", 12) as number;
		const allStats = statsCalc.getAllDailyStats();

		const today = new Date();
		const startDate = new Date(today);
		startDate.setMonth(startDate.getMonth() - months);
		// Align to Monday
		const startDay = startDate.getDay();
		const startMonday = startDay === 0 ? 6 : startDay - 1;
		startDate.setDate(startDate.getDate() - startMonday);

		const cells: HeatmapCell[] = [];
		let daysActive = 0;
		let totalReviews = 0;
		const counts: number[] = [];

		const cursor = new Date(startDate);
		while (cursor <= today) {
			const key = cursor.toISOString().split("T")[0] ?? "";
			const stats = allStats[key];
			const count = stats?.reviewsCompleted ?? 0;
			counts.push(count);
			if (count > 0) daysActive++;
			totalReviews += count;
			cursor.setDate(cursor.getDate() + 1);
		}

		// Calculate intensity levels using percentiles
		const nonZeroCounts = counts.filter((c) => c > 0).sort((a, b) => a - b);
		const p25 = nonZeroCounts[Math.floor(nonZeroCounts.length * 0.25)] ?? 1;
		const p50 = nonZeroCounts[Math.floor(nonZeroCounts.length * 0.5)] ?? 2;
		const p75 = nonZeroCounts[Math.floor(nonZeroCounts.length * 0.75)] ?? 5;

		function getLevel(count: number): 0 | 1 | 2 | 3 | 4 {
			if (count === 0) return 0;
			if (count <= p25) return 1;
			if (count <= p50) return 2;
			if (count <= p75) return 3;
			return 4;
		}

		// Build cells
		const resetCursor = new Date(startDate);
		let col = 0;
		const monthLabels: { label: string; col: number }[] = [];
		let lastMonth = -1;

		while (resetCursor <= today) {
			const key = resetCursor.toISOString().split("T")[0] ?? "";
			const dayOfWeek = resetCursor.getDay();
			const row = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Mon=0 ... Sun=6
			const stats = allStats[key];
			const count = stats?.reviewsCompleted ?? 0;

			// Track month labels
			const month = resetCursor.getMonth();
			if (month !== lastMonth && row === 0) {
				monthLabels.push({ label: MONTH_NAMES[month] ?? "", col });
				lastMonth = month;
			}

			cells.push({ date: key, count, level: getLevel(count), row, col });

			// Advance to next day; increment col on Mondays
			resetCursor.setDate(resetCursor.getDate() + 1);
			if (resetCursor.getDay() === 1 || (resetCursor.getDay() === 0 && row === 6)) {
				// Moved from Sunday to Monday -> new week
			}
			// Recalculate col from next day
			const nextDow = resetCursor.getDay();
			const nextRow = nextDow === 0 ? 6 : nextDow - 1;
			if (nextRow === 0 && resetCursor <= today) {
				col++;
			}
		}

		return { cells, monthLabels, daysActive, totalReviews, maxWeeks: col + 1 };
	}, [plugin, ver, config]);

	if (!data) {
		return <div class="ep:text-obs-muted ep:text-xs ep:p-3">Loading...</div>;
	}

	const showLegend = configValue(config, "showLegend", true);
	const showTotal = configValue(config, "showTotal", true);

	const svgWidth = data.maxWeeks * CELL_TOTAL + 30;
	const svgHeight = 7 * CELL_TOTAL + 20;

	const handleCellHover = (cell: HeatmapCell, e: MouseEvent) => {
		const rect = containerRef.current?.getBoundingClientRect();
		if (!rect) return;
		setTooltip({
			cell,
			x: e.clientX - rect.left,
			y: e.clientY - rect.top - 30,
		});
	};

	const handleCellLeave = () => {
		setTooltip(null);
	};

	const handleStatsClick = () => {
		plugin.openStatsView().catch(() => {});
	};

	return (
		<div class="ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:text-sm" ref={containerRef} style={{ position: "relative" }}>
			{/* Header */}
			<div class="ep:flex ep:items-center ep:justify-between ep:text-xs">
				<span class="ep:font-semibold">
					Activity (last {configValue(config, "months", 12)} months)
				</span>
				<span
					class="ep:text-obs-muted ep:cursor-pointer hover:ep:underline"
					onClick={handleStatsClick}
				>
					{data.daysActive} days active
				</span>
			</div>

			{/* SVG heatmap */}
			<div class="ep:overflow-x-auto">
				<svg width={svgWidth} height={svgHeight} style={{ display: "block" }}>
					{/* Month labels */}
					{data.monthLabels.map((ml) => (
						<text
							key={`${ml.label}-${ml.col}`}
							x={ml.col * CELL_TOTAL + 30}
							y={10}
							fill="var(--text-muted)"
							font-size="9"
						>
							{ml.label}
						</text>
					))}

					{/* Grid cells */}
					{data.cells.map((cell) => (
						<rect
							key={cell.date}
							x={cell.col * CELL_TOTAL + 30}
							y={cell.row * CELL_TOTAL + 16}
							width={CELL_SIZE}
							height={CELL_SIZE}
							rx={2}
							fill={LEVEL_COLORS[cell.level]}
							opacity={LEVEL_OPACITIES[cell.level]}
							onMouseEnter={(e) => handleCellHover(cell, e as unknown as MouseEvent)}
							onMouseLeave={handleCellLeave}
							style={{ cursor: "pointer" }}
						/>
					))}
				</svg>
			</div>

			{/* Legend + total */}
			<div class="ep:flex ep:items-center ep:justify-between ep:text-xs ep:text-obs-muted">
				{showLegend && (
					<div class="ep:flex ep:items-center ep:gap-1">
						<span>Less</span>
						{[0, 1, 2, 3, 4].map((level) => (
							<div
								key={level}
								style={{
									width: `${CELL_SIZE}px`,
									height: `${CELL_SIZE}px`,
									borderRadius: "2px",
									backgroundColor: LEVEL_COLORS[level],
									opacity: LEVEL_OPACITIES[level],
								}}
							/>
						))}
						<span>More</span>
					</div>
				)}
				{showTotal && (
					<span
						class="ep:cursor-pointer hover:ep:underline"
						onClick={handleStatsClick}
					>
						Total: {data.totalReviews.toLocaleString()}
					</span>
				)}
			</div>

			{/* Tooltip */}
			{tooltip && (
				<div
					class="ep:absolute ep:bg-obs-bg-secondary ep:border ep:border-obs-modifier-border ep:rounded ep:px-2 ep:py-1 ep:text-xs ep:shadow-md ep:z-10 ep:pointer-events-none"
					style={{
						left: `${tooltip.x}px`,
						top: `${tooltip.y}px`,
						transform: "translateX(-50%)",
					}}
				>
					<div class="ep:font-semibold">{tooltip.cell.count} reviews</div>
					<div class="ep:text-obs-muted">{tooltip.cell.date}</div>
				</div>
			)}
		</div>
	);
}
