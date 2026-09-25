/**
 * One "schedule a break" flow shared by the Dashboard's per-project action
 * and the FSRS settings' saved breaks: validate dates, preview, confirm,
 * redistribute through FSRSHelperService with an undoable command, notify.
 */

import type {
	BreakScheduleOptions,
	SchedulingResult,
} from "@true-recall/core/metrics/fsrs-tools/scheduler/scheduler.types";
import type { ScheduledBreak } from "@true-recall/core/types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const BREAK_DATES_ERROR =
	"Enter valid YYYY-MM-DD dates (end not before start).";

/** A real calendar day in YYYY-MM-DD form (2026-02-31 is rejected) */
function isCalendarDay(value: string): boolean {
	if (!DATE_PATTERN.test(value)) return false;
	const parsed = new Date(`${value}T00:00:00.000Z`);
	return (
		!Number.isNaN(parsed.getTime()) &&
		parsed.toISOString().slice(0, 10) === value
	);
}

export function isValidBreakRange(startDate: string, endDate: string): boolean {
	return (
		isCalendarDay(startDate) && isCalendarDay(endDate) && endDate >= startDate
	);
}

export interface BreakHelper {
	previewBreak(
		startDate: string,
		endDate: string,
		cardIds?: string[],
	): { cardsAffected: number; breakDays: number };
	scheduleBreakPeriod(options: BreakScheduleOptions): SchedulingResult;
}

export interface BreakNotifier {
	info(message: string): void;
	success(message: string): void;
	error(message: string): void;
	operationFailed(operation: string, error?: unknown): void;
}

export interface ScheduleBreakFlowDeps {
	helper: BreakHelper | null | undefined;
	confirm: (options: {
		title: string;
		message: string;
		confirmLabel: string;
	}) => Promise<boolean>;
	/** Records the applied changes as one undoable command */
	applyChanges: (result: SchedulingResult, description: string) => void;
	notify: BreakNotifier;
}

export interface ScheduleBreakRequest {
	startDate: string;
	endDate: string;
	/** Restrict to these cards (one project); omit for every card */
	cardIds?: string[];
	/** e.g. `in "Biology"`; omitted for the all-cards scope */
	scopeLabel?: string;
	redistributeBefore?: boolean;
	redistributeAfter?: boolean;
	/** Message when no card is due inside the break */
	emptyMessage?: string;
}

export type ScheduleBreakStatus =
	| "invalid"
	| "unavailable"
	| "empty"
	| "cancelled"
	| "applied"
	| "failed";

export interface ScheduleBreakOutcome {
	status: ScheduleBreakStatus;
	affectedCount: number;
}

export async function runScheduleBreak(
	deps: ScheduleBreakFlowDeps,
	request: ScheduleBreakRequest,
): Promise<ScheduleBreakOutcome> {
	const { startDate, endDate, cardIds, scopeLabel } = request;
	if (!isValidBreakRange(startDate, endDate)) {
		deps.notify.error(BREAK_DATES_ERROR);
		return { status: "invalid", affectedCount: 0 };
	}
	if (!deps.helper) {
		deps.notify.error("Scheduling tools are not ready yet.");
		return { status: "unavailable", affectedCount: 0 };
	}

	const scope = scopeLabel ? ` ${scopeLabel}` : "";
	try {
		const preview = deps.helper.previewBreak(startDate, endDate, cardIds);
		if (preview.cardsAffected === 0) {
			deps.notify.info(
				request.emptyMessage ?? "No cards due during this break.",
			);
			return { status: "empty", affectedCount: 0 };
		}

		const confirmed = await deps.confirm({
			title: "Schedule a break",
			message: `Redistribute ${preview.cardsAffected} cards${scope} due during ${startDate} – ${endDate} (${preview.breakDays} days)?`,
			confirmLabel: "Schedule break",
		});
		if (!confirmed) return { status: "cancelled", affectedCount: 0 };

		const result = deps.helper.scheduleBreakPeriod({
			startDate,
			endDate,
			cardIds,
			redistributeBefore: request.redistributeBefore,
			redistributeAfter: request.redistributeAfter,
			dryRun: false,
		});
		if (result.affectedCount === 0) {
			deps.notify.info("No cards needed redistribution.");
			return { status: "empty", affectedCount: 0 };
		}

		deps.applyChanges(
			result,
			`Schedule break${scope} (${result.affectedCount} cards)`,
		);
		deps.notify.success(
			`Redistributed ${result.affectedCount} cards around the break (Ctrl+Z to undo)`,
		);
		return { status: "applied", affectedCount: result.affectedCount };
	} catch (err) {
		deps.notify.operationFailed("schedule break", err);
		return { status: "failed", affectedCount: 0 };
	}
}

/**
 * A saved break is stored only once its redistribution ran; from then on new
 * reviews avoid it. A break with no cards due inside it is treated as a
 * continuation and stores nothing, like a cancelled or failed flow.
 */
export function shouldSaveBreak(status: ScheduleBreakStatus): boolean {
	return status === "applied";
}

export function createScheduledBreak(
	startDate: string,
	endDate: string,
	id: string,
): ScheduledBreak {
	return {
		id,
		startDate,
		endDate,
		redistributeBefore: true,
		redistributeAfter: true,
	};
}
