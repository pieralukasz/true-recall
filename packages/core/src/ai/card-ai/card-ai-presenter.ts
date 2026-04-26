import type { CardFields } from "./card-ai.types";
import type { CardAITarget } from "./card-ai-target";

export interface CardAIRetryResult {
	edits: CardFields;
	newCards: CardFields[];
}

export interface CardAIPresentArgs {
	target: CardAITarget;
	original: CardFields;
	/**
	 * The proposed edits to the current card, or `null` when the model
	 * returned [0] verbatim (no semantic change). Also `null` for raw-fallback
	 * UI on unparseable responses (then `rawResponse` is set).
	 */
	proposed: CardFields | null;
	/**
	 * New cards the model proposes to spawn ([1..N] from the response array).
	 * Empty array when the model returned a single-element response.
	 */
	proposedNewCards: CardFields[];
	rawResponse?: string;
	/** Auto-apply edits to the current card without preview. */
	autoApplyEdits: boolean;
	/** Auto-apply spawned new cards without preview. Independent from edits. */
	autoApplyNewCards: boolean;
	retry: (extraInstruction: string) => Promise<CardAIRetryResult>;
}

export interface CardAIPresenter {
	present(args: CardAIPresentArgs): Promise<void>;
}
