import type { CardFields } from "./card-ai.types";

/**
 * Abstracts "where does the card live?" for the AI pipeline.
 * Consumers (review, draft modal, future generate-from-note) implement this
 * and hand an instance to `CardAIRunner`.
 */
export interface CardAITarget {
	getFields(): CardFields;
	getNoteType(): { id: string; name: string; fields: string[] };
	getSourceUid(): string | undefined;
	getCurrentCardId(): string | null;
	apply(fields: CardFields): void;
}
