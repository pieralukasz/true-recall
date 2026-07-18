/**
 * Copy and scale helpers for the daily-target picker. Pure functions so the
 * wording and slider bounds are testable without rendering.
 */

import {
	PACE_LOOKBACK_DAYS,
	projectCatchUp,
	type WorkloadDecision,
} from "@true-recall/core/metrics/fsrs-tools";

export interface TargetReference {
	label: string;
	value: number;
	hint: string;
}

export function buildTargetReferences(
	decision: WorkloadDecision,
): TargetReference[] {
	return [
		{
			label: "Floor",
			value: decision.targetFloor,
			hint: "Upcoming dues per day — below this the backlog grows",
		},
		{
			label: "Your median",
			value: decision.medianPace,
			hint: `Typical pace on days you studied (last ${PACE_LOOKBACK_DAYS} days)`,
		},
		{
			label: "Good days",
			value: decision.p75Pace,
			hint: "75th percentile of your active days",
		},
	];
}

export function describeTargetConsequence(
	decision: WorkloadDecision,
	target: number,
): string {
	if (decision.backlogSize === 0) {
		return `No backlog — ${target}/day covers your upcoming ~${decision.steadyStatePerDay}/day of dues.`;
	}
	const catchUp = projectCatchUp(
		target,
		decision.steadyStatePerDay,
		decision.backlogSize,
		new Date(),
	);
	if (catchUp.days === null) {
		return `Below your upcoming dues (~${decision.steadyStatePerDay}/day) — the ${decision.backlogSize}-card backlog will keep growing.`;
	}
	return `Backlog of ${decision.backlogSize} cards clears in ~${catchUp.days} days (${catchUp.date}).`;
}

export function describeSuggestion(decision: WorkloadDecision): string {
	if (decision.usedPaceFallback) {
		return `Suggested: ~${decision.suggestedTarget}/day — 30-day forecast average (not enough review history yet to measure your pace).`;
	}
	return `Suggested: ~${decision.suggestedTarget}/day — your median pace on active days, never below the ${decision.targetFloor}/day floor.`;
}

/** Nudge when the pinned target outruns demonstrated pace */
export function describeDrift(
	decision: WorkloadDecision,
	target: number,
): string | null {
	if (decision.usedPaceFallback || decision.p75Pace === 0) return null;
	if (target > decision.p75Pace) {
		return `Heads up: ${target}/day is above your good-days pace (${decision.p75Pace}/day) — consider re-picking.`;
	}
	return null;
}

/** Slider ceiling: 1.5× the largest useful anchor, rounded up to tens */
export function sliderMax(
	decision: WorkloadDecision,
	currentTarget: number,
): number {
	const anchor = Math.max(
		50,
		decision.suggestedTarget,
		decision.p75Pace,
		decision.targetFloor,
		currentTarget,
	);
	return Math.ceil((anchor * 1.5) / 10) * 10;
}
