import type { ComponentProps } from "preact";

import { DEFAULT_LEECH_THRESHOLD } from "@true-recall/core/helpers/leech-helpers";
import type {
	FSRSFlashcardItem,
	ReviewSessionTopUpAvailability,
} from "@true-recall/core/types";

import type { PresetPickerOption } from "@true-recall/obsidian/features/study/ui/review/components";
import type { AnswerHandler } from "@true-recall/obsidian/features/study/ui/review/handlers";
import {
	isRatingLockedForTypeIn,
	isTypeInRequiredForCard,
	suggestedRatingToGrade,
} from "@true-recall/obsidian/features/study/ui/review/helpers";
import {
	isCustomSession,
	type SessionFilters,
} from "@true-recall/obsidian/features/study/ui/review/review.types";
import type TrueRecallPlugin from "@true-recall/obsidian/main";
import type { AppStore } from "@true-recall/obsidian/store";

import type { ReviewApp } from "./ReviewApp";
import type { TypeInController } from "./TypeInController";

type ReviewModel = ComponentProps<typeof ReviewApp>["model"];

export interface ReviewPresenterDeps {
	plugin: TrueRecallPlugin;
	store: AppStore;
	filters: SessionFilters;
	actions: ReviewModel["actions"];
	typeIn: TypeInController;
	answerHandler: AnswerHandler;
	getQueuedFollowUpCount: () => number;
	getTopUpAvailability: () => ReviewSessionTopUpAvailability;
	getPresetOptions: () => PresetPickerOption[];
}
export function createReviewModel(deps: ReviewPresenterDeps): ReviewModel {
	return {
		store: deps.store,
		actions: deps.actions,
		session: {
			kind: isCustomSession(deps.filters) ? "custom" : "standard",
			continuous: deps.plugin.settings.continuousCustomReviews,
			cramming: deps.filters.crammingMode ?? false,
			retrievabilityMode: deps.filters.schedulingMode === "retrievability",
			display: {
				header: deps.plugin.settings.showReviewHeader,
				headerStats: deps.plugin.settings.showReviewHeaderStats,
				nextReviewTime: deps.plugin.settings.showNextReviewTime,
			},
		},
		card: {
			getQueuedFollowUpCount: deps.getQueuedFollowUpCount,
			getTopUpAvailability: deps.getTopUpAvailability,
			getTypeInState: (card, isAnswerRevealed) => {
				const requiresTypeIn = isTypeInRequiredForCard(
					card,
					deps.typeIn.enabled,
				);
				const state = deps.typeIn.getCurrentTypeInState(card.id);
				return {
					typeInMode: deps.typeIn.getTypeInMode(),
					useTypeInMode: requiresTypeIn,
					typedAnswer: state.typedAnswer,
					isCheckingAnswer: state.isChecking,
					isRatingLocked: isRatingLockedForTypeIn({
						requiresTypeIn,
						isAnswerRevealed,
						isChecking: state.isChecking,
					}),
					localAssessment: state.localAssessment,
					semanticResult: state.semanticResult,
					semanticMessage: state.semanticMessage,
					suggestedRating: suggestedRatingToGrade(
						state.semanticResult?.suggestedRating,
					),
				};
			},
			getPresetName: (card: FSRSFlashcardItem) =>
				deps.answerHandler.resolvePreset(card).name,
			getPresetOptions: deps.getPresetOptions,
			getLeechThreshold: (card: FSRSFlashcardItem) =>
				deps.answerHandler.resolvePreset(card).leechThreshold ??
				DEFAULT_LEECH_THRESHOLD,
			resolveAudioPath: (card: FSRSFlashcardItem) => {
				if (!card.noteId) return undefined;
				const note = deps.plugin.cardStore?.notes.getById(card.noteId);
				if (!note?.fields) return undefined;
				for (const [key, value] of Object.entries(note.fields)) {
					if (key.startsWith("_audio_") && value) return value;
				}
				return undefined;
			},
		},
	};
}
