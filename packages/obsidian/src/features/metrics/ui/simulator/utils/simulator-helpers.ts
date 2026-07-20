import type { MetricType, SequenceReview, SliderConfig } from "../types";

export function getMetricData(
	reviews: SequenceReview[],
	metricType: MetricType,
): number[] {
	return reviews.map((r) => {
		switch (metricType) {
			case "interval":
				return r.interval;
			case "stability":
				return r.stability;
			case "difficulty":
				return r.difficulty;
			case "cumulative":
				return r.cumulativeInterval;
			default:
				return r.interval;
		}
	});
}

export function getMetricLabel(metricType: MetricType): string {
	switch (metricType) {
		case "interval":
			return "Interval (days)";
		case "stability":
			return "Stability";
		case "difficulty":
			return "Difficulty (0-10)";
		case "cumulative":
			return "Cumulative Interval (days)";
		default:
			return "Value";
	}
}

export function formatSliderValue(value: number, config: SliderConfig): string {
	const decimals = config.step < 0.01 ? 4 : config.step < 0.1 ? 2 : 1;
	return value.toFixed(decimals);
}

export const BUTTON_CLS = [
	"ep:px-3 ep:py-1.5",
	"ep:bg-obs-secondary ep:text-obs-normal",
	"ep:border ep:border-obs-border ep:rounded-md",
	"ep:cursor-pointer ep:text-ui-smaller",
	"ep:hover:bg-obs-modifier-hover",
].join(" ");
