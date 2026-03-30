import type { NotePriority } from "./types";

export const PRIORITY_DOT: Record<NotePriority, string> = {
	overdue: "ep:bg-obs-red",
	hot: "ep:bg-obs-orange",
	due: "ep:bg-obs-blue",
	light: "ep:bg-obs-green",
	done: "ep:bg-obs-faint",
};

export function computePriority(note: {
	overdueCount: number;
	due: number;
	learning: number;
	newCount: number;
}): NotePriority {
	if (note.overdueCount > 0) return "overdue";
	if (note.due + note.learning >= 10) return "hot";
	if (note.due + note.learning > 0) return "due";
	if (note.newCount > 0) return "light";
	return "done";
}

const SECONDS_PER_REVIEW = 8;
const SECONDS_PER_NEW = 30;
const SECONDS_PER_LEARNING = 15;

export function estimateStudyMinutes(
	due: number,
	newCount: number,
	learning: number,
): number {
	const totalSeconds =
		due * SECONDS_PER_REVIEW +
		newCount * SECONDS_PER_NEW +
		learning * SECONDS_PER_LEARNING;
	return Math.ceil(totalSeconds / 60);
}

export function formatEstimatedTime(minutes: number): string {
	if (minutes < 1) return "<1 min";
	if (minutes < 60) return `${minutes} min`;
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
