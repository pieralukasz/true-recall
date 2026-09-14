import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SemanticGradingResult } from "@true-recall/core/types";

import { TypeInController } from "../../../src/views/review/TypeInController";
import { createMockCard, createTestStore } from "../../store/test-helpers";

const verdict: SemanticGradingResult = {
	verdict: "correct",
	teacherComment: "Correct",
	covered: ["answer"],
	missing: [],
	errors: [],
	suggestedRating: "good",
};

function createController() {
	const store = createTestStore();
	store
		.getState()
		.review.startSession([
			createMockCard({ id: "card-1", question: "Question", answer: "Answer" }),
			createMockCard({ id: "card-2" }),
		]);
	const grade = vi.fn().mockResolvedValue(verdict);
	const showAnswer = vi.fn(() => store.getState().review.revealAnswer());
	const controller = new TypeInController({
		getReview: () => store.getState().review,
		getSettings: () => ({ proKey: "test", defaultTypeInMode: "ai" }) as never,
		getStorage: () => ({ getItem: () => null, setItem: vi.fn() }),
		grade,
		showAnswer,
		resolveGradingContext: async () => ({}),
	});
	controller.applyDefaultTypeInMode();
	return { controller, store, grade, showAnswer };
}

describe("TypeInController", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-09-14T10:00:00Z"));
	});
	afterEach(() => vi.useRealTimers());
	it("reveals an empty answer without requesting AI grading", async () => {
		const f = createController();
		await f.controller.handleReveal();
		expect(f.grade).not.toHaveBeenCalled();
		expect(f.showAnswer).toHaveBeenCalledOnce();
	});
	it("keeps the answer hidden while grading and ignores duplicate reveals", async () => {
		const f = createController();
		const pending = Promise.withResolvers<SemanticGradingResult>();
		f.grade.mockReturnValue(pending.promise);
		f.controller.handleTypedAnswerChange("Answer");
		const revealing = f.controller.handleReveal();
		await f.controller.handleReveal();
		expect(f.controller.isRatingLocked()).toBe(true);
		expect(f.showAnswer).not.toHaveBeenCalled();
		expect(f.grade).toHaveBeenCalledOnce();
		pending.resolve(verdict);
		await revealing;
		expect(f.showAnswer).toHaveBeenCalledOnce();
		expect(f.controller.getCurrentTypeInState("card-1").semanticResult).toEqual(
			verdict,
		);
		expect(f.controller.isRatingLocked()).toBe(false);
	});
	it("reveals a local fallback when AI grading fails", async () => {
		const f = createController();
		f.grade.mockRejectedValue(new Error("Provider unavailable"));
		f.controller.handleTypedAnswerChange("Answer");
		await f.controller.handleReveal();
		const state = f.controller.getCurrentTypeInState("card-1");
		expect(state.semanticMessage).toBe("Provider unavailable");
		expect(state.localAssessment).not.toBeNull();
		expect(state.isChecking).toBe(false);
		expect(f.showAnswer).toHaveBeenCalledOnce();
	});
	it.each([
		"another card",
		"same card in a restarted session",
	])("discards late grading after switching to %s", async (mode) => {
		const f = createController();
		const pending = Promise.withResolvers<SemanticGradingResult>();
		f.grade.mockReturnValue(pending.promise);
		f.controller.handleTypedAnswerChange("Answer");
		const revealing = f.controller.handleReveal();
		await Promise.resolve();
		if (mode === "another card") f.store.getState().review.nextCard();
		f.controller.resetTypeInState(
			f.store.getState().review.getCurrentCard()?.id,
		);
		pending.resolve(verdict);
		await revealing;
		expect(f.showAnswer).not.toHaveBeenCalled();
		expect(
			f.controller.getCurrentTypeInState(
				f.store.getState().review.getCurrentCard()?.id ?? "",
			).semanticResult,
		).toBeNull();
	});
});
