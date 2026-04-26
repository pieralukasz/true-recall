import type { CardFields } from "./card-ai.types";

/**
 * Abstracts "where does the card live?" for the AI pipeline — review, draft
 * modal, and any future generator plug this interface into CardAIRunner.
 */
export interface CardAITarget {
	getFields(): CardFields;
	getNoteType(): { id: string; name: string; fields: string[] };
	getSourceUid(): string | undefined;
	getCurrentCardId(): string | undefined;
	/**
	 * Persist new values. Returns `true` on success, `false` when the target
	 * can no longer accept writes (card advanced, note deleted, modal closed).
	 */
	apply(fields: CardFields): boolean;
	/**
	 * Create a new card alongside the current one, inheriting note type and
	 * source. Returns the IDs of all created cards (cloze produces multiple),
	 * or `null` if creation failed (target invalid). Optional — targets that
	 * don't support spawning leave it undefined.
	 */
	createCard?(fields: CardFields): string[] | null;
	/**
	 * Remove a card by id, used to undo auto-applied spawns. Returns `true`
	 * on success. Optional — targets that don't support removal leave it
	 * undefined; presenter checks before calling.
	 */
	removeCard?(cardId: string): boolean;
}
