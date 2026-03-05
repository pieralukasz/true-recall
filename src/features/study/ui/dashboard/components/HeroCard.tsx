import type { TodayProgress } from "../types";
import { DashboardHeader } from "./DashboardHeader";
import { SessionActions } from "./SessionActions";
import { StudyProgress } from "./StudyProgress";

interface HeroCardProps {
	totalDue: number;
	startReviewCount?: number;
	totalNew: number;
	totalOverdue: number;
	noteCount: number;
	estimatedMinutes: number;
	streak: number;
	progress: TodayProgress;
}

export function HeroCard({
	totalDue,
	startReviewCount,
	totalNew,
	totalOverdue,
	noteCount,
	estimatedMinutes,
	streak,
	progress,
}: HeroCardProps) {
	return (
		<div class="ep:rounded-lg ep:border ep:border-obs-border ep:bg-obs-primary ep:p-4 ep:flex ep:flex-col ep:gap-4">
			<DashboardHeader
				totalDue={totalDue}
				totalNew={totalNew}
				noteCount={noteCount}
				estimatedMinutes={estimatedMinutes}
				streak={streak}
			/>
			<StudyProgress progress={progress} />
			<SessionActions
				totalDue={totalDue}
				startReviewCount={startReviewCount}
				totalOverdue={totalOverdue}
				estimatedMinutes={estimatedMinutes}
			/>
		</div>
	);
}
