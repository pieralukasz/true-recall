import { h, render } from "preact";

import { FSRS_COLORS } from "@true-recall/obsidian/helpers/fsrs-colors";

export interface NoteDetailStats {
	retentionRate: number | null;
	avgDifficulty: number;
	avgLapses: number;
	lastReviewed: string | null;
	reviewCount: number;
	futureDue: number[];
}

interface TooltipProps {
	stats: NoteDetailStats;
}

const SPARKLINE_CHARS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

function roundAverageLapses(avgLapses: number): number {
	return Number(avgLapses.toFixed(1));
}

function formatLapses(lapses: number): string {
	return `${lapses} ${lapses === 1 ? "lapse" : "lapses"}`;
}

export function formatReviewSummary(
	reviewCount: number,
	avgLapses: number,
): string {
	return `Review #${reviewCount} • ${formatLapses(roundAverageLapses(avgLapses))}`;
}

function sparkline(values: number[]): string {
	const max = Math.max(1, ...values);
	return values
		.map((v) => {
			const idx = Math.round((v / max) * (SPARKLINE_CHARS.length - 1));
			return SPARKLINE_CHARS[idx] ?? "▁";
		})
		.join("");
}

function NoteStatsTooltipContent({ stats }: TooltipProps) {
	const retention =
		stats.retentionRate !== null
			? `${Math.round(stats.retentionRate * 100)}%`
			: "—";
	const difficulty = stats.avgDifficulty.toFixed(1);
	const lastDate = stats.lastReviewed
		? new Date(stats.lastReviewed).toLocaleDateString()
		: "Never";
	const spark = sparkline(stats.futureDue);
	const hasUpcoming = stats.futureDue.some((v) => v > 0);
	const roundedLapses = roundAverageLapses(stats.avgLapses);
	const lapseColor =
		roundedLapses === 0 ? FSRS_COLORS.new.cssVar : FSRS_COLORS.learning.cssVar;

	return (
		<div class="ep:flex ep:flex-col ep:gap-1.5 ep:text-xs ep:min-w-[180px]">
			<div class="ep:font-medium ep:text-obs-muted">
				<span>Review </span>
				<strong style={{ color: `var(${FSRS_COLORS.review.cssVar})` }}>
					#{stats.reviewCount}
				</strong>
				<span class="ep:text-obs-faint">{" • "}</span>
				<strong style={{ color: `var(${lapseColor})` }}>
					{formatLapses(roundedLapses)}
				</strong>
			</div>
			<div class="ep:grid ep:grid-cols-2 ep:gap-x-4 ep:gap-y-0.5">
				<span>
					Retention:{" "}
					<strong style={{ color: `var(${FSRS_COLORS.new.cssVar})` }}>
						{retention}
					</strong>
				</span>
				<span>Difficulty: {difficulty}</span>
				<span class="ep:col-span-2">Last: {lastDate}</span>
			</div>
			{hasUpcoming && (
				<div class="ep:pt-1 ep:border-t ep:border-obs-modifier-border">
					<span class="ep:text-obs-muted">Next 7d: </span>
					<span
						style={{
							color: `var(${FSRS_COLORS.review.cssVar})`,
							letterSpacing: "1px",
						}}
					>
						{spark}
					</span>
				</div>
			)}
		</div>
	);
}

// ── Tooltip DOM management ──────────────────────────────────

let activeTooltip: HTMLElement | null = null;
let hoverTimeout: number | null = null;

export function attachTooltipListeners(
	element: HTMLElement,
	getStats: () => Promise<NoteDetailStats | null>,
): void {
	element.addEventListener("mouseenter", () => {
		hoverTimeout = window.setTimeout(() => {
			void getStats().then((stats) => {
				if (!stats) return;
				showTooltip(element, stats);
			});
		}, 300);
	});

	element.addEventListener("mouseleave", () => {
		if (hoverTimeout) {
			window.clearTimeout(hoverTimeout);
			hoverTimeout = null;
		}
		hideTooltip();
	});
}

function showTooltip(anchor: HTMLElement, stats: NoteDetailStats): void {
	hideTooltip();

	const tooltip = createDiv();
	tooltip.className = "true-recall-note-tooltip";
	tooltip.style.cssText = `
		position: fixed;
		z-index: var(--layer-popover, 1000);
		padding: 8px 10px;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m, 6px);
		box-shadow: var(--shadow-s, 0 2px 8px rgba(0,0,0,0.15));
		pointer-events: none;
	`;

	render(h(NoteStatsTooltipContent, { stats }), tooltip);

	activeDocument.body.appendChild(tooltip);
	activeTooltip = tooltip;

	// Position above anchor
	const rect = anchor.getBoundingClientRect();
	const tooltipRect = tooltip.getBoundingClientRect();
	let top = rect.top - tooltipRect.height - 6;
	let left = rect.left + rect.width / 2 - tooltipRect.width / 2;

	// Keep within viewport
	if (top < 4) top = rect.bottom + 6;
	if (left < 4) left = 4;
	if (left + tooltipRect.width > window.innerWidth - 4) {
		left = window.innerWidth - tooltipRect.width - 4;
	}

	tooltip.style.top = `${top}px`;
	tooltip.style.left = `${left}px`;
}

function hideTooltip(): void {
	if (activeTooltip) {
		render(null, activeTooltip);
		activeTooltip.remove();
		activeTooltip = null;
	}
}
