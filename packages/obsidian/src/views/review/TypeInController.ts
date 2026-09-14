import type { Grade } from "ts-fsrs";

import type {
	FSRSFlashcardItem,
	LocalAnswerAssessment,
	SemanticGradingResult,
	TrueRecallSettings,
} from "@true-recall/core/types";

import type { AnswerHandler } from "@true-recall/obsidian/features/study/ui/review/handlers";
import {
	assessTypedAnswer,
	deriveTypeInMode,
	type getTypeInModeStorage,
	isRatingLockedForTypeIn,
	isTypeInRequiredForCard,
	nextTypeInMode,
	persistTypeInMode,
	readPersistedTypeInMode,
	shouldRunAIGradingOnReveal,
	suggestedRatingToGrade,
	type TypeInMode,
} from "@true-recall/obsidian/features/study/ui/review/helpers";
import { notify } from "@true-recall/obsidian/services/notification.service";
import type { ReviewApi } from "@true-recall/obsidian/store";

import { isPluginEnabled } from "../../plugin/plugin-utils";
export interface TypeInAssessmentState {
	cardId: string | null;
	typedAnswer: string;
	localAssessment: LocalAnswerAssessment | null;
	semanticResult: SemanticGradingResult | null;
	semanticMessage: string | null;
	isChecking: boolean;
}

function createEmptyTypeInState(
	cardId: string | null = null,
): TypeInAssessmentState {
	return {
		cardId,
		typedAnswer: "",
		localAssessment: null,
		semanticResult: null,
		semanticMessage: null,
		isChecking: false,
	};
}

export interface TypeInControllerDeps {
	getReview: () => ReviewApi;
	getSettings: () => TrueRecallSettings;
	getStorage: () => ReturnType<typeof getTypeInModeStorage>;
	showAnswer: () => void;
	grade: AnswerHandler["gradeTypedAnswerSemantically"];
	resolveGradingContext: (
		card: FSRSFlashcardItem,
	) => Promise<Parameters<AnswerHandler["gradeTypedAnswerSemantically"]>[2]>;
}
export class TypeInController {
	private typeInState: TypeInAssessmentState = createEmptyTypeInState();
	private revision = 0;
	enabled = false;
	constructor(private deps: TypeInControllerDeps) {}
	private get review(): ReviewApi {
		return this.deps.getReview();
	}

	getCurrentTypeInState(cardId: string): TypeInAssessmentState {
		if (this.typeInState.cardId !== cardId) {
			return createEmptyTypeInState(cardId);
		}
		return this.typeInState;
	}

	setTypeInState(cardId: string, patch: Partial<TypeInAssessmentState>): void {
		const current = this.getCurrentTypeInState(cardId);
		this.typeInState = {
			...current,
			...patch,
			cardId,
		};
		this.review.notifyChange();
	}

	resetTypeInState(cardId: string | null = null): void {
		this.revision += 1;
		this.typeInState = createEmptyTypeInState(cardId);
	}

	applyDefaultTypeInMode(): void {
		if (!isPluginEnabled(this.deps.getSettings(), "type-in-mode")) {
			this.enabled = false;
			return;
		}
		const persisted = readPersistedTypeInMode(this.deps.getStorage());
		// Settings persisted before the diff-mode removal may still hold "diff";
		// anything that is not "off" now means AI grading.
		const mode = persisted ?? this.deps.getSettings().defaultTypeInMode;
		this.enabled = mode !== "off";
	}

	getTypeInMode(): TypeInMode {
		return deriveTypeInMode(this.enabled);
	}

	cycleTypeInMode(): void {
		if (!isPluginEnabled(this.deps.getSettings(), "type-in-mode")) return;
		const currentMode = this.getTypeInMode();
		const card = this.review.getCurrentCard();
		const alwaysTypeIn = !!(card?.alwaysTypeIn || card?.fsrs.alwaysTypeIn);
		const nextMode = nextTypeInMode(currentMode, alwaysTypeIn);
		const currentId = card?.id ?? null;

		this.enabled = nextMode !== "off";
		persistTypeInMode(this.deps.getStorage(), nextMode);

		// When answer is already revealed, preserve grading results;
		// the UI shows/hides assessment based on mode flags.
		if (this.review.isAnswerRevealed) {
			this.review.notifyChange();
			notify().info(this.getTypeInModeMessage(nextMode));
			return;
		}

		this.resetTypeInState(currentId);
		this.review.notifyChange();
		notify().info(this.getTypeInModeMessage(nextMode));
	}

	getTypeInModeMessage(mode: TypeInMode): string {
		return mode === "ai" ? "Type in: On" : "Type in: Off";
	}

	isTypeInRequiredForCurrentCard(): boolean {
		return isTypeInRequiredForCard(this.review.getCurrentCard(), this.enabled);
	}

	getSuggestedRatingForCurrentCard(): Grade | null {
		const card = this.review.getCurrentCard();
		if (!card) return null;
		const state = this.getCurrentTypeInState(card.id);
		return suggestedRatingToGrade(state.semanticResult?.suggestedRating);
	}

	isRatingLocked(): boolean {
		const card = this.review.getCurrentCard();
		if (!card) return false;
		const state = this.getCurrentTypeInState(card.id);
		return isRatingLockedForTypeIn({
			requiresTypeIn: this.isTypeInRequiredForCurrentCard(),
			isAnswerRevealed: this.review.isAnswerRevealed,
			isChecking: state.isChecking,
		});
	}

	handleTypedAnswerChange(value: string): void {
		const card = this.review.getCurrentCard();
		if (!card || !this.isTypeInRequiredForCurrentCard()) return;
		this.revision += 1;

		this.setTypeInState(card.id, {
			typedAnswer: value,
			localAssessment: null,
			semanticResult: null,
			semanticMessage: null,
			isChecking: false,
		});
	}

	async handleReveal(): Promise<void> {
		const card = this.review.getCurrentCard();
		if (!card) return;
		const revision = this.revision;
		const requiresTypeIn = this.isTypeInRequiredForCurrentCard();
		if (!requiresTypeIn) {
			this.deps.showAnswer();
			return;
		}

		const state = this.getCurrentTypeInState(card.id);
		const typedAnswer = state.typedAnswer.trim();
		// A check is already in flight; ignore repeated reveal requests.
		if (state.isChecking) return;

		const shouldRunAI = shouldRunAIGradingOnReveal({
			requiresTypeIn,
			typedAnswer: state.typedAnswer,
			isChecking: state.isChecking,
		});

		// Empty input: plain reveal, no grading.
		if (!shouldRunAI) {
			this.deps.showAnswer();
			this.setTypeInState(card.id, {
				localAssessment: null,
				semanticResult: null,
				semanticMessage: null,
				isChecking: false,
			});
			return;
		}

		// Two-stage reveal: grade the user's answer first; the model answer
		// stays hidden until the verdict (or failure) lands. The local diff
		// is computed up front only as the AI-failure fallback display.
		const localAssessment = assessTypedAnswer(card.answer ?? "", typedAnswer);
		this.setTypeInState(card.id, {
			isChecking: true,
			localAssessment,
			semanticResult: null,
			semanticMessage: null,
		});

		let semanticResult: SemanticGradingResult | null = null;
		let semanticMessage: string | null = null;
		try {
			const gradingContext = await this.deps.resolveGradingContext(card);
			semanticResult = await this.deps.grade(card, typedAnswer, gradingContext);
		} catch (error) {
			semanticMessage =
				error instanceof Error
					? error.message
					: "AI grading unavailable. Please rate manually.";
		}

		const activeCard = this.review.getCurrentCard();
		if (!activeCard || activeCard.id !== card.id || revision !== this.revision)
			return;

		this.deps.showAnswer();
		this.setTypeInState(card.id, {
			isChecking: false,
			semanticResult,
			semanticMessage,
		});
	}
}
