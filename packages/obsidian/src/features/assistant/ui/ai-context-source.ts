import type { AssistantContext } from "@true-recall/core/ai/assistant";
import type { FSRSFlashcardItem } from "@true-recall/core/types";

/** The card fields a live context needs — a structural subset of
 * `FSRSFlashcardItem` so callers can pass review queue items directly. */
export type AssistantContextCard = Pick<
	FSRSFlashcardItem,
	"id" | "noteId" | "question" | "answer" | "sourceUid" | "sourceNotePath"
> & { fsrs: Pick<FSRSFlashcardItem["fsrs"], "noteTypeId"> };

export interface LiveContextInputs {
	/** Card currently shown in review, or null when no session is running. */
	reviewCard: AssistantContextCard | null;
	/** Path of the note open in the workspace, when there is one. */
	activeNotePath: string | null;
	/** Current text selection, when there is one. */
	selectedText: string | null;
}

/** Maps a card to the card slice of an assistant context. Shared by the review
 * view and the docked workspace so both describe a card identically. */
export function assistantContextFromCard(
	card: AssistantContextCard,
	selectedText?: string,
): AssistantContext {
	const context: AssistantContext = {
		card: {
			cardId: card.id,
			noteId: card.noteId,
			noteTypeId: card.fsrs.noteTypeId,
			question: card.question,
			answer: card.answer,
			sourceUid: card.sourceUid,
			sourceNotePath: card.sourceNotePath,
		},
	};
	if (card.sourceNotePath) context.activeNotePath = card.sourceNotePath;
	if (selectedText) context.selectedText = selectedText;
	return context;
}

/** Resolves what the AI is talking about right now. A card under review wins
 * over the open note, because that is what the user is looking at. */
export function resolveAssistantContext(
	inputs: LiveContextInputs,
): AssistantContext {
	const selectedText = inputs.selectedText?.trim() || undefined;

	if (inputs.reviewCard) {
		return assistantContextFromCard(inputs.reviewCard, selectedText);
	}

	const context: AssistantContext = {};
	if (inputs.activeNotePath) context.activeNotePath = inputs.activeNotePath;
	if (selectedText) context.selectedText = selectedText;
	return context;
}

/** True when two contexts describe the same subject, so the docked workspace can
 * skip re-rendering on unrelated workspace churn. */
export function isSameAssistantSubject(
	a: AssistantContext,
	b: AssistantContext,
): boolean {
	return (
		a.card?.cardId === b.card?.cardId &&
		a.activeNotePath === b.activeNotePath &&
		a.selectedText === b.selectedText
	);
}

/** Short human label for the pinned-context strip. */
export function describeAssistantContext(context: AssistantContext): string {
	if (context.card) return context.card.question;
	if (context.activeNotePath) {
		const name = context.activeNotePath.split("/").pop() ?? "";
		return name.replace(/\.md$/, "");
	}
	return "No card or note";
}
