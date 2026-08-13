/**
 * R-Mode session plumbing.
 *
 * The session size travels config -> filters -> view state -> queue options.
 * Every hop is a place where it can silently vanish, and a vanished size means
 * the session quietly falls back to a due-date queue.
 */

import { describe, expect, it } from "vitest";

import { SessionService } from "../../../src/services/review/session.service";
import {
	filtersFromViewState,
	filtersToViewState,
	normalizeSessionFilters,
} from "../../../src/types/review-session.types";
import type { SessionConfig } from "../../../src/types/session-config.types";

const SETTINGS = { ignoreDailyLimitsForNoteStudy: true, dayStartHour: 4 };

const CONFIGS: [string, SessionConfig][] = [
	["all_due", { mode: "all_due", rModeTargetCount: 25 }],
	["note", { mode: "note", sourceUid: "uid-1", rModeTargetCount: 25 }],
	["notes", { mode: "notes", noteNames: ["A"], rModeTargetCount: 25 }],
	["project", { mode: "project", projectPath: "P", rModeTargetCount: 25 }],
	["created_today", { mode: "created_today", rModeTargetCount: 25 }],
	["weak_cards", { mode: "weak_cards", rModeTargetCount: 25 }],
	["overdue", { mode: "overdue", rModeTargetCount: 25 }],
	["study_ahead", { mode: "study_ahead", days: 3, rModeTargetCount: 25 }],
	["custom", { mode: "custom", weakCardsOnly: true, rModeTargetCount: 25 }],
];

describe("SessionService.resolveFilters — R-Mode size", () => {
	const service = new SessionService();

	it.each(CONFIGS)("carries the size through the %s mode", (_name, config) => {
		const filters = service.resolveFilters(config, SETTINGS);

		expect(filters.rModeTargetCount).toBe(25);
	});

	it("leaves the size absent when the caller states none", () => {
		const filters = service.resolveFilters({ mode: "all_due" }, SETTINGS);

		expect(filters.rModeTargetCount).toBeUndefined();
	});

	it("does not let the custom-mode spread shadow the base value", () => {
		// `custom` spreads its own config over `base`; if rModeTargetCount were
		// left in the spread it would overwrite the resolved value with itself
		// and any future divergence would go unnoticed.
		const filters = service.resolveFilters(
			{ mode: "custom", rModeTargetCount: 7, overdueOnly: true },
			SETTINGS,
		);

		expect(filters.rModeTargetCount).toBe(7);
		expect(filters.overdueOnly).toBe(true);
		expect("mode" in filters).toBe(false);
	});

	it.each([
		"all_due",
		"note",
		"notes",
		"project",
	] as const)("marks a normal %s session as retrievability-driven", (mode) => {
		const configs: Record<typeof mode, SessionConfig> = {
			all_due: { mode: "all_due" },
			note: { mode: "note", sourceUid: "uid-1" },
			notes: { mode: "notes", noteNames: ["A"] },
			project: { mode: "project", projectPath: "P" },
		};
		const filters = service.resolveFilters(configs[mode], {
			...SETTINGS,
			rModeEnabled: true,
		});

		expect(filters.schedulingMode).toBe("retrievability");
	});

	it("keeps specialized sessions due-driven even when R-Mode is enabled", () => {
		const filters = service.resolveFilters(
			{ mode: "overdue", rModeTargetCount: 25 },
			{ ...SETTINGS, rModeEnabled: true },
		);

		expect(filters.schedulingMode).toBe("due");
	});
});

describe("view-state round trip", () => {
	it("survives filters -> view state -> filters", () => {
		const original = {
			sourceUidFilter: "uid-1",
			rModeTargetCount: 42,
			schedulingMode: "retrievability" as const,
			topUp: { kind: "review" as const, count: 5 },
		};

		const restored = filtersFromViewState(filtersToViewState(original));

		expect(restored.rModeTargetCount).toBe(42);
		expect(restored.schedulingMode).toBe("retrievability");
		expect(restored.topUp).toEqual({ kind: "review", count: 5 });
	});

	it("stays absent when it was never set", () => {
		const restored = filtersFromViewState(
			filtersToViewState({ sourceUidFilter: "uid-1" }),
		);

		expect(restored.rModeTargetCount).toBeUndefined();
	});

	it("is preserved by filter normalisation", () => {
		const normalized = normalizeSessionFilters({
			rModeTargetCount: 12,
			topUp: { kind: "new", count: 3 },
			sourceNoteFilter: "",
		});

		expect(normalized.rModeTargetCount).toBe(12);
		expect(normalized.topUp).toEqual({ kind: "new", count: 3 });
		expect(normalized.sourceNoteFilter).toBeUndefined();
	});
});
