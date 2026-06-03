import type { TodayProgress } from "../types";

export interface TodayProgressSegments {
	newPct: number;
	reviewPct: number;
	learningPct: number;
}

export function computeTodayProgressSegments(
	progress: TodayProgress,
	totalActionable: number,
): TodayProgressSegments {
	const studied = Math.max(0, progress.studied);
	const remaining = Math.max(0, totalActionable);
	const totalWork = studied + remaining;

	if (totalWork === 0) {
		return { newPct: 0, reviewPct: 0, learningPct: 0 };
	}

	const newCards = Math.min(Math.max(0, progress.newCards), studied);
	const reviewCards = Math.min(
		Math.max(0, progress.reviewCards),
		studied - newCards,
	);
	const learningCards = Math.max(0, studied - newCards - reviewCards);

	return {
		newPct: newCards / totalWork,
		reviewPct: reviewCards / totalWork,
		learningPct: learningCards / totalWork,
	};
}
