import type { CardFields } from "./card-ai.types";

export type CardAITargetOperation = "edit" | "create";

/**
 * Abstracts "where does the card live?" for the AI pipeline — review, draft
 * modal, and any future generator plug this interface into CardAIRunner.
 */
export interface CardAITarget {
	getFields(): CardFields;
	getNoteType(): { id: string; name: string; fields: string[] };
	getSourceUid(): string | undefined;
	getCurrentCardId(): string | undefined;
	getOperation(): CardAITargetOperation;
	/**
	 * Persist new values. Returns `true` on success, `false` when the target
	 * can no longer accept writes (card advanced, note deleted, modal closed).
	 */
	apply(fields: CardFields): boolean;
}
