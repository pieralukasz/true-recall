import type { RetrievabilitySummary } from "@true-recall/core/services";

/**
 * Band colours run from "being lost" to "safe". They deliberately reuse
 * Obsidian's own accent variables so the bar tracks the user's theme.
 */
const BANDS = [
	{ key: "urgent", label: "at risk", cls: "ep:bg-obs-red" },
	{ key: "losing", label: "slipping", cls: "ep:bg-obs-orange" },
	{ key: "known", label: "known", cls: "ep:bg-obs-blue" },
	{ key: "fresh", label: "fresh", cls: "ep:bg-obs-green/50" },
] as const satisfies ReadonlyArray<{
	key: keyof Pick<
		RetrievabilitySummary,
		"urgent" | "losing" | "known" | "fresh"
	>;
	label: string;
	cls: string;
}>;

interface RetentionBandsProps {
	summary: RetrievabilitySummary;
}

/**
 * Distribution of cards across retrievability bands.
 *
 * A single average hides a dying deck behind a healthy one, so the spread is
 * the primary reading and the mean is only a headline elsewhere.
 */
export function RetentionBands({ summary }: RetentionBandsProps) {
	if (summary.total === 0) return null;

	const segments = BANDS.map((band) => ({
		...band,
		count: summary[band.key],
		percent: (summary[band.key] / summary.total) * 100,
	})).filter((segment) => segment.count > 0);

	return (
		<div class="ep:flex ep:flex-col ep:gap-1.5">
			<div class="ep:flex ep:h-1.5 ep:w-full ep:overflow-hidden ep:rounded-full ep:bg-obs-modifier-border">
				{segments.map((segment) => (
					<div
						key={segment.key}
						class={segment.cls}
						style={{ width: `${segment.percent}%` }}
						title={`${segment.count} ${segment.label}`}
					/>
				))}
			</div>

			<div class="ep:flex ep:flex-wrap ep:items-center ep:gap-x-2 ep:gap-y-0.5 ep:text-ui-smaller ep:text-obs-faint">
				{segments.map((segment) => (
					<span key={segment.key} class="ep:whitespace-nowrap">
						{segment.count} {segment.label}
					</span>
				))}
			</div>
		</div>
	);
}
