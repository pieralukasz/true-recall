import { dataVersion, useSignalVersion } from "@shared/services/signals";
import { Clickable } from "@shared/ui/components";
import { usePlugin } from "@shared/ui/preact";
import { useMemo } from "preact/hooks";
import { configValue, parseCodeblockConfig } from "../config-parser";
import { WidgetCta } from "../WidgetCta";

type Intensity = "none" | "low" | "medium" | "high" | "max";

function getIntensity(streak: number): Intensity {
	if (streak === 0) return "none";
	if (streak < 5) return "low";
	if (streak < 10) return "medium";
	if (streak < 25) return "high";
	return "max";
}

const INTENSITY_COLORS: Record<Intensity, string> = {
	none: "var(--text-muted)",
	low: "var(--color-green)",
	medium: "var(--color-yellow)",
	high: "var(--color-orange)",
	max: "var(--color-red)",
};

const FLAMES: Record<Intensity, string> = {
	none: "",
	low: "\u{1F525}",
	medium: "\u{1F525}\u{1F525}",
	high: "\u{1F525}\u{1F525}\u{1F525}",
	max: "\u{1F525}\u{1F525}\u{1F525}\u{1F525}",
};

export function AnswerStreakWidget({ source }: { source: string }) {
	const plugin = usePlugin();
	const ver = useSignalVersion(dataVersion);

	const config = useMemo(() => parseCodeblockConfig(source), [source]);

	const data = useMemo(() => {
		const stats = plugin.cardStore?.stats;
		if (!stats) return null;
		return stats.getAnswerStreakInfo();
	}, [plugin, ver]);

	if (!data) return null;

	const showBest = configValue(config, "showBest", true);
	const showToday = configValue(config, "showToday", true);

	const handleClick = () => {
		plugin.openCustomStudyModal().catch(() => {});
	};

	if (data.current === 0 && data.todayBest === 0 && data.allTimeBest === 0) {
		return (
			<Clickable
				class="ep:flex ep:items-center ep:gap-3 ep:p-3 ep:text-xs"
				onClick={handleClick}
			>
				<span class="ep:text-obs-muted">
					Start reviewing to build your streak!
				</span>
				<span class="ep:ml-auto">
					<WidgetCta label="Review \u2192" onClick={handleClick} />
				</span>
			</Clickable>
		);
	}

	const intensity = getIntensity(data.current);
	const color = INTENSITY_COLORS[intensity];
	const flames = FLAMES[intensity];

	return (
		<Clickable
			class="ep:flex ep:items-center ep:gap-2 ep:p-3 ep:text-sm ep:flex-wrap"
			onClick={handleClick}
		>
			{flames && <span>{flames}</span>}

			<span class="ep:text-lg ep:font-bold" style={{ color }}>
				{data.current}
			</span>
			<span class="ep:text-xs ep:text-obs-muted">correct</span>

			{showToday && data.todayBest > 0 && (
				<>
					<span class="ep:text-obs-faint">&middot;</span>
					<span class="ep:text-xs ep:text-obs-muted">
						today: {data.todayBest}
					</span>
				</>
			)}

			{showBest && data.allTimeBest > 0 && (
				<>
					<span class="ep:text-obs-faint">&middot;</span>
					<span class="ep:text-xs ep:text-obs-muted">
						best: {data.allTimeBest}
					</span>
				</>
			)}

			<span class="ep:ml-auto">
				<WidgetCta label="Review \u2192" onClick={handleClick} />
			</span>
		</Clickable>
	);
}
