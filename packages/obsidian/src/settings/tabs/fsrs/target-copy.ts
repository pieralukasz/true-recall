import { t } from "@true-recall/obsidian/i18n";

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
			get label() {
				return t("Floor");
			},
			value: decision.targetFloor,
			get hint() {
				return t("Upcoming dues per day — below this the backlog grows");
			},
		},
		{
			get label() {
				return t("Your median");
			},
			value: decision.medianPace,
			hint: t("Typical pace on days you studied (last {0} days)", [
				PACE_LOOKBACK_DAYS,
			]),
		},
		{
			get label() {
				return t("Good days");
			},
			value: decision.p75Pace,
			get hint() {
				return t("75th percentile of your active days");
			},
		},
	];
}

export function describeTargetConsequence(
	decision: WorkloadDecision,
	target: number,
): string {
	if (decision.backlogSize === 0) {
		return t("No backlog — {0}/day covers your upcoming ~{1}/day of dues.", [
			target,
			decision.steadyStatePerDay,
		]);
	}
	const catchUp = projectCatchUp(
		target,
		decision.steadyStatePerDay,
		decision.backlogSize,
		new Date(),
	);
	if (catchUp.days === null) {
		return t(
			"Below your upcoming dues (~{0}/day) — the {1}-card backlog will keep growing.",
			[decision.steadyStatePerDay, decision.backlogSize],
		);
	}
	return t("Backlog of {0} cards clears in ~{1} days ({2}).", [
		decision.backlogSize,
		catchUp.days,
		catchUp.date,
	]);
}

export function describeSuggestion(decision: WorkloadDecision): string {
	if (decision.usedPaceFallback) {
		return t(
			"Suggested: ~{0}/day — 30-day forecast average (not enough review history yet to measure your pace).",
			[decision.suggestedTarget],
		);
	}
	return t(
		"Suggested: ~{0}/day — your median pace on active days, never below the {1}/day floor.",
		[decision.suggestedTarget, decision.targetFloor],
	);
}

/** Nudge when the pinned target outruns demonstrated pace */
export function describeDrift(
	decision: WorkloadDecision,
	target: number,
): string | null {
	if (decision.usedPaceFallback || decision.p75Pace === 0) return null;
	if (target > decision.p75Pace) {
		return t(
			"Heads up: {0}/day is above your good-days pace ({1}/day) — consider re-picking.",
			[target, decision.p75Pace],
		);
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
