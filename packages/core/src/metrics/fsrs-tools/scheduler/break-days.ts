/**
 * Scheduled break days
 *
 * Saved breaks (settings.scheduledBreaks) are YYYY-MM-DD ranges. Day keys are
 * compared as UTC days, the same keys the SQL due-date queries and the load
 * balancer use.
 */

import type { ScheduledBreak } from "../../../types";

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

interface BreakSpan {
	start: number;
	end: number;
	allowBefore: boolean;
	allowAfter: boolean;
}

export interface BreakShift {
	newDue: string;
	daysChanged: number;
}

function dayNumber(dayKey: string): number {
	return Math.round(Date.parse(`${dayKey}T00:00:00.000Z`) / DAY_MS);
}

function dayKeyOf(date: Date): string {
	return date.toISOString().slice(0, 10);
}

/**
 * Overlapping or back-to-back breaks merge into one span, so a due date
 * moved out of one break can never land in the next one.
 */
function toSpans(breaks: readonly ScheduledBreak[]): BreakSpan[] {
	const spans = breaks
		.filter(
			(brk) =>
				DAY_KEY.test(brk.startDate) &&
				DAY_KEY.test(brk.endDate) &&
				brk.startDate <= brk.endDate,
		)
		.map((brk) => ({
			start: dayNumber(brk.startDate),
			end: dayNumber(brk.endDate),
			allowBefore: brk.redistributeBefore !== false,
			allowAfter: brk.redistributeAfter !== false,
		}))
		.filter((span) => Number.isFinite(span.start) && Number.isFinite(span.end))
		.sort((a, b) => a.start - b.start);

	const merged: BreakSpan[] = [];
	for (const span of spans) {
		const last = merged[merged.length - 1];
		if (last && span.start <= last.end + 1) {
			last.end = Math.max(last.end, span.end);
			last.allowBefore &&= span.allowBefore;
			last.allowAfter &&= span.allowAfter;
		} else {
			merged.push({ ...span });
		}
	}
	return merged;
}

export function isInScheduledBreak(
	dayKey: string,
	breaks: readonly ScheduledBreak[],
): boolean {
	if (breaks.length === 0 || !DAY_KEY.test(dayKey)) return false;
	const day = dayNumber(dayKey);
	return toSpans(breaks).some((span) => day >= span.start && day <= span.end);
}

/**
 * Move a due date that falls inside a saved break to the nearest edge of the
 * break: the day before it starts (only if that is still in the future) or
 * the day after it ends. Ties go to the day before, an earlier review being
 * the safer side for memory. The mapping never reorders two dues, so rating
 * buttons stay monotonic. Returns null when the due is outside every break.
 */
export function moveDueOutOfBreaks(
	due: string,
	breaks: readonly ScheduledBreak[],
	todayKey: string,
): BreakShift | null {
	if (breaks.length === 0) return null;
	const dueDate = new Date(due);
	if (Number.isNaN(dueDate.getTime())) return null;

	const dueDay = dayNumber(dayKeyOf(dueDate));
	const span = toSpans(breaks).find(
		(candidate) => dueDay >= candidate.start && dueDay <= candidate.end,
	);
	if (!span) return null;

	const before = span.start - 1;
	const after = span.end + 1;
	const canBefore = span.allowBefore && before > dayNumber(todayKey);
	const canAfter = span.allowAfter || !canBefore;
	const target =
		canBefore && (!canAfter || dueDay - before <= after - dueDay)
			? before
			: after;

	const daysChanged = target - dueDay;
	const newDate = new Date(dueDate);
	newDate.setUTCDate(newDate.getUTCDate() + daysChanged);
	return { newDue: newDate.toISOString(), daysChanged };
}
