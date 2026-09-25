import type { CardFlag } from "@true-recall/core/types";

import type { ReviewSliceActions } from "@true-recall/obsidian/store/types";

import type { ReviewSliceContext } from "./review-slice-context";
import { INITIAL_EDIT_MODE } from "./review-state";
export function createReviewEditActions({
	set,
	get,
}: ReviewSliceContext): Pick<
	ReviewSliceActions,
	| "getEditState"
	| "startEdit"
	| "cancelEdit"
	| "isEditing"
	| "updateCurrentCardContent"
	| "updateCurrentCardComment"
	| "updateCurrentCardFlag"
	| "notifyChange"
> {
	return {
		getEditState: () => ({ ...get().review.editMode }),

		startEdit: (field: "question" | "answer") => {
			const state = get().review;
			const card = state.queue[state.currentIndex];
			if (!card) return;

			set((s) => ({
				review: {
					...s.review,
					editMode: {
						active: true,
						field,
						originalQuestion: card.question,
						originalAnswer: card.answer,
					},
				},
			}));
		},

		cancelEdit: () => {
			set((s) => ({
				review: {
					...s.review,
					editMode: { ...INITIAL_EDIT_MODE },
				},
			}));
		},

		isEditing: () => get().review.editMode.active,

		updateCurrentCardContent: (question: string, answer: string) => {
			const state = get().review;
			const card = state.queue[state.currentIndex];
			if (!card) return;

			const newQueue = [...state.queue];
			newQueue[state.currentIndex] = {
				...card,
				question,
				answer,
			};

			set((s) => ({
				review: { ...s.review, queue: newQueue },
			}));
		},

		updateCurrentCardComment: (userComment: string | undefined) => {
			const state = get().review;
			const card = state.queue[state.currentIndex];
			if (!card) return;

			const newQueue = [...state.queue];
			newQueue[state.currentIndex] = { ...card, userComment };

			set((s) => ({
				review: { ...s.review, queue: newQueue },
			}));
		},

		updateCurrentCardFlag: (flag: CardFlag) => {
			const state = get().review;
			const card = state.queue[state.currentIndex];
			if (!card) return;

			const newQueue = [...state.queue];
			newQueue[state.currentIndex] = {
				...card,
				fsrs: { ...card.fsrs, flag },
			};

			set((s) => ({
				review: { ...s.review, queue: newQueue },
			}));
		},

		notifyChange: () => {
			set((s) => ({ review: { ...s.review } }));
		},
	};
}
